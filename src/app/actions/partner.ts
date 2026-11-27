"use server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parse } from "@/lib/validation";
import { appUrl } from "@/lib/email";
import { partnerMessageAI } from "@/lib/ai";
import { RULE_ORDER, partnerMessageWritten } from "@/lib/distance";
import { ASKABLE_ROLES, MAX_PARTNERS, aiAllowedFor, firstName, rewriteReport } from "@/lib/distanceReport";

const done = (runId: string, fd: FormData) => `/assessment/check/${runId}/done${fd.get("from") === "start" ? "?from=start" : ""}#partner`;
const partnerLink = (token: string) => `${appUrl()}/partner/${token}`;

/** Their own finished run, with its rules and the partners asked, or nothing. */
async function myFinishedRun(userId: string, runId: string) {
  const run = await db.distanceRun.findFirst({ where: { id: runId, userId, completedAt: { not: null } }, include: { rules: true, partners: true } });
  if (!run) throw new Error("Not found");
  return run;
}

/** One partner asked about one of their own runs, or nothing. */
async function myPartner(userId: string, partnerId: string) {
  const p = await db.distancePartner.findFirst({ where: { id: partnerId, run: { userId } } });
  if (!p) throw new Error("Not found");
  return p;
}

/**
 * Gets the message ready for one partner. Nothing is sent: the person sees exactly what that partner
 * will get, and the page the link opens, before it goes. One message per person, up to three people.
 */
export async function askPartner(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const d = parse(z.object({ runId: z.string(), relId: z.string() }), fd);
  const run = await myFinishedRun(u.id, d.runId);
  if (run.partners.length >= MAX_PARTNERS || run.partners.some((p) => p.relId === d.relId)) redirect(done(run.id, fd));
  const rel = await db.relationship.findFirst({ where: { id: d.relId, ownerId: u.id, active: true, role: { in: ASKABLE_ROLES } } });
  if (!rel) throw new Error("Not found");
  const token = randomBytes(24).toString("base64url");
  const link = partnerLink(token);
  const name = firstName(u.name), partnerName = firstName(rel.name);
  const lines = RULE_ORDER.map((k) => run.rules.find((r) => r.pillar === k)?.line ?? "");
  const ai = (await aiAllowedFor(u.id)) ? await partnerMessageAI({ name, partnerName, lines, link }).catch(() => null) : null;
  await db.distancePartner.create({ data: { runId: run.id, relId: rel.id, name: rel.name, token, message: ai ?? partnerMessageWritten(name, partnerName, link) } });
  redirect(done(run.id, fd));
}

/** Changed their mind before sending: nothing goes out, and the link never works. */
export async function cancelPartner(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const d = parse(z.object({ partnerId: z.string() }), fd);
  const p = await myPartner(u.id, d.partnerId);
  if (p.status === "READY") await db.distancePartner.delete({ where: { id: p.id } });
  redirect(done(p.runId, fd));
}

/**
 * Called from the phone after the share sheet: keeps the message as they sent it, and the report
 * now says it's waiting on that partner. The link has to still be in the message.
 */
export async function markPartnerSent(input: { partnerId: string; message: string }): Promise<{ ok: true } | { error: string }> {
  const u = await requireUser("PARTICIPANT");
  const d = z.object({ partnerId: z.string(), message: z.string().trim().min(1).max(1000) }).safeParse(input);
  if (!d.success) return { error: "Write a message first." };
  const p = await myPartner(u.id, d.data.partnerId);
  if (p.status === "ANSWERED") return { error: "This has already been answered." };
  if (!d.data.message.includes(`/partner/${p.token}`)) return { error: "Keep the link in the message, so they can answer." };
  await db.distancePartner.update({ where: { id: p.id }, data: { status: "SENT", message: d.data.message } });
  if (p.status === "READY") await rewriteReport(p.runId);
  revalidatePath(`/assessment/check/${p.runId}/done`);
  return { ok: true };
}

/**
 * A partner's answers, from their link. No account needed. One answer for each line, Rarely to Almost always,
 * and an example if they want. Once answered, the link only says thanks, and the person's report is written again.
 */
export async function answerPartner(fd: FormData) {
  const rating = z.coerce.number().int().min(1).max(4);
  const example = z.string().trim().max(600).default("");
  const d = parse(z.object({
    token: z.string().min(10).max(100),
    F: rating, O: rating, R: rating, G: rating, E: rating,
    exF: example, exO: example, exR: example, exG: example, exE: example,
  }), fd);
  const p = await db.distancePartner.findUnique({ where: { token: d.token } });
  if (!p || p.status !== "SENT") redirect(`/partner/${d.token}`);
  const answers = Object.fromEntries(RULE_ORDER.map((k) => [k, { rating: d[k], example: d[`ex${k}` as const] }]));
  // Only a link still waiting can be answered, so two taps at once can't both count.
  const n = await db.distancePartner.updateMany({ where: { id: p.id, status: "SENT" }, data: { status: "ANSWERED", answers: JSON.stringify(answers), answeredAt: new Date() } });
  if (n.count) await rewriteReport(p.runId);
  redirect(`/partner/${d.token}?thanks=1`);
}
