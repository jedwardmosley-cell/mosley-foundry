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
import { aiAllowedFor, firstName, writeReport } from "@/lib/distanceReport";

/** The roles that can be asked for their view: the people someone named to hold them to it. */
const ASKABLE = ["ACCOUNTABILITY_PARTNER", "MENTOR"];

const done = (runId: string, fd: FormData) => `/assessment/check/${runId}/done${fd.get("from") === "start" ? "?from=start" : ""}#partner`;
const partnerLink = (token: string) => `${appUrl()}/partner/${token}`;

/** Their own finished run, or nothing. */
async function myFinishedRun(userId: string, runId: string) {
  const run = await db.distanceRun.findFirst({ where: { id: runId, userId, completedAt: { not: null } }, include: { rules: true } });
  if (!run) throw new Error("Not found");
  return run;
}

/**
 * Gets the message ready for one partner. Nothing is sent: the person sees exactly what the partner
 * will get, and the page the link opens, before it goes. One message per check, not five.
 */
export async function askPartner(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const d = parse(z.object({ runId: z.string(), relId: z.string() }), fd);
  const run = await myFinishedRun(u.id, d.runId);
  if (run.partnerStatus === "SENT" || run.partnerStatus === "ANSWERED") redirect(done(run.id, fd));
  const rel = await db.relationship.findFirst({ where: { id: d.relId, ownerId: u.id, active: true, role: { in: ASKABLE } } });
  if (!rel) throw new Error("Not found");
  const token = randomBytes(24).toString("base64url");
  const link = partnerLink(token);
  const name = firstName(u.name), partnerName = firstName(rel.name);
  const lines = RULE_ORDER.map((k) => run.rules.find((r) => r.pillar === k)?.line ?? "");
  const ai = (await aiAllowedFor(u.id)) ? await partnerMessageAI({ name, partnerName, lines, link }).catch(() => null) : null;
  await db.distanceRun.update({
    where: { id: run.id },
    data: { partnerRelId: rel.id, partnerToken: token, partnerStatus: "READY", partnerMessage: ai ?? partnerMessageWritten(name, partnerName, link) },
  });
  redirect(done(run.id, fd));
}

/** Changed their mind before sending: nothing goes out, and the link stops working. */
export async function cancelPartner(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const d = parse(z.object({ runId: z.string() }), fd);
  const run = await myFinishedRun(u.id, d.runId);
  if (run.partnerStatus !== "READY") redirect(done(run.id, fd));
  await db.distanceRun.update({ where: { id: run.id }, data: { partnerRelId: null, partnerToken: null, partnerStatus: "NONE", partnerMessage: "" } });
  redirect(done(run.id, fd));
}

/**
 * Called from the phone after the share sheet: keeps the message as they sent it, and the report
 * now says it's waiting on the partner. The link has to still be in the message.
 */
export async function markPartnerSent(input: { runId: string; message: string }): Promise<{ ok: true } | { error: string }> {
  const u = await requireUser("PARTICIPANT");
  const d = z.object({ runId: z.string(), message: z.string().trim().min(1).max(1000) }).safeParse(input);
  if (!d.success) return { error: "Write a message first." };
  const run = await myFinishedRun(u.id, d.data.runId);
  if (!run.partnerToken || run.partnerStatus === "ANSWERED") return { error: "This has already been answered." };
  if (!d.data.message.includes(`/partner/${run.partnerToken}`)) return { error: "Keep the link in the message, so they can answer." };
  const status = run.partnerStatus === "READY" ? "SENT" : run.partnerStatus;
  const updated = await db.distanceRun.update({ where: { id: run.id }, data: { partnerStatus: status, partnerMessage: d.data.message }, include: { rules: true } });
  if (run.partnerStatus === "READY") await db.distanceRun.update({ where: { id: run.id }, data: { report: JSON.stringify(await writeReport(updated)) } });
  revalidatePath(`/assessment/check/${run.id}/done`);
  return { ok: true };
}

/**
 * The partner's answers, from the link. No account needed. One answer for each line, Rarely to Almost always,
 * and an example if they want. Once answered, the link only says thanks, and the person's report is written again.
 */
export async function answerPartner(fd: FormData) {
  const rating = z.coerce.number().int().min(1).max(4);
  const d = parse(z.object({
    token: z.string().min(10).max(100),
    F: rating, O: rating, R: rating, G: rating, E: rating,
    exF: z.string().trim().max(600).default(""), exO: z.string().trim().max(600).default(""), exR: z.string().trim().max(600).default(""),
    exG: z.string().trim().max(600).default(""), exE: z.string().trim().max(600).default(""),
  }), fd);
  const run = await db.distanceRun.findUnique({ where: { partnerToken: d.token } });
  if (!run || run.partnerStatus !== "SENT") redirect(`/partner/${d.token}`);
  await db.$transaction(RULE_ORDER.map((k) => db.distanceRule.update({
    where: { runId_pillar: { runId: run.id, pillar: k } },
    data: { partnerRating: d[k], partnerExample: d[`ex${k}` as const] },
  })));
  const answered = await db.distanceRun.update({ where: { id: run.id }, data: { partnerStatus: "ANSWERED", partnerAnsweredAt: new Date() }, include: { rules: true } });
  await db.distanceRun.update({ where: { id: run.id }, data: { report: JSON.stringify(await writeReport(answered)) } });
  redirect(`/partner/${d.token}?thanks=1`);
}
