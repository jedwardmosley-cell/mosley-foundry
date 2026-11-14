"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parse } from "@/lib/validation";
import { addDays } from "@/lib/dates";
import { SETUP_STEPS, FINDS_OUT_ROLES, type SetupField } from "@/content/weekOne";

const FIELDS = SETUP_STEPS.map((s) => s.field) as [SetupField, ...SetupField[]];
const NEXT_OK = /^\/cycle\/setup\?step=(1|2|3|4|5|plan|share)$/;

async function activeCycle(userId: string) {
  const c = await db.developmentCycle.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { startDate: "desc" } });
  if (!c) redirect("/cycle/new");
  return c;
}

/** Saves one week 1 answer. The first thing written is kept as the first guess. */
export async function saveSetupStep(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const d = parse(z.object({ field: z.enum(FIELDS), value: z.string().trim().max(1500), next: z.string() }), fd);
  const c = await activeCycle(u.id);
  const first = JSON.parse(c.firstGuess || "{}") as Record<string, string>;
  if (d.value && !first[d.field]) first[d.field] = d.value;
  await db.developmentCycle.update({ where: { id: c.id }, data: { [d.field]: d.value, firstGuess: JSON.stringify(first) } });
  redirect(NEXT_OK.test(d.next) ? d.next : "/cycle/setup?step=plan");
}

/** Saves the plan in the client's wording. The new response becomes the practice the coach can see with Practice sharing. */
export async function savePlan(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const d = parse(z.object({ plan: z.string().trim().min(1, "Write your plan").max(1500) }), fd);
  const c = await activeCycle(u.id);
  await db.developmentCycle.update({ where: { id: c.id }, data: { plan: d.plan, focus: c.newResponse.slice(0, 500) || c.focus } });
  revalidatePath("/dashboard");
  redirect("/cycle/setup?step=share");
}

/** Adds someone to My people from the "Who finds out?" step. */
export async function addFindsOutPerson(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const d = parse(z.object({ name: z.string().trim().min(1, "Enter a name").max(120), role: z.enum(FINDS_OUT_ROLES) }), fd);
  const cadenceDays = d.role === "MENTOR" ? 30 : 14;
  await db.relationship.create({ data: { ownerId: u.id, name: d.name, role: d.role, cadenceDays, nextCheckIn: addDays(new Date(), cadenceDays) } });
  revalidatePath("/network");
  redirect("/cycle/setup?step=share");
}

const shareSchema = z.object({
  kind: z.enum(["plan", "mentee", "week2", "week3", "week4", "day30"]),
  to: z.string().min(1),
  feeling: z.boolean().default(false),
  old: z.boolean().default(false),
  gap: z.boolean().default(false),
});

/**
 * Called when the client taps Send. The message goes from the client's own phone (share sheet,
 * text or email), so the app records the tap. Sending the plan completes week 1 setup.
 */
export async function markShared(input: z.input<typeof shareSchema>): Promise<{ ok: true } | { error: string }> {
  const u = await requireUser("PARTICIPANT");
  const d = shareSchema.safeParse(input);
  if (!d.success) return { error: "Something was missing." };
  const c = await db.developmentCycle.findFirst({ where: { userId: u.id, status: { in: ["ACTIVE", "COMPLETED"] } }, orderBy: { startDate: "desc" } });
  if (!c) return { error: "No 30 days in progress." };
  const person = await db.relationship.findFirst({ where: { id: d.data.to, ownerId: u.id, active: true } });
  if (!person) return { error: "That person is not in My people." };
  const log = JSON.parse(c.sharedLog || "[]") as { at: string; to: string; kind: string }[];
  log.push({ at: new Date().toISOString(), to: person.id, kind: d.data.kind });
  await db.developmentCycle.update({
    where: { id: c.id },
    data: {
      sharedLog: JSON.stringify(log),
      ...(d.data.kind === "plan" ? { partnerId: person.id, shareFeeling: d.data.feeling, shareOld: d.data.old, shareGap: d.data.gap, setupDoneAt: c.setupDoneAt ?? new Date() } : {}),
    },
  });
  revalidatePath("/dashboard");
  revalidatePath("/cycle");
  return { ok: true };
}
