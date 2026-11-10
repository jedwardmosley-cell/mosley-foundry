"use server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { bool, parse, pillarKey, score, text } from "@/lib/validation";
import { addDays, ymd } from "@/lib/dates";
import { PATHWAYS, BLUEPRINT_AREAS, RELATIONSHIP_ROLES } from "@/content/program";
import { SHARE_SCOPES } from "@/lib/access";
import { CHECKIN_TAGS } from "@/content/options";

const participant = () => requireUser("PARTICIPANT");

// ---------- Onboarding and profile ----------

export async function choosePathway(fd: FormData) {
  const u = await participant();
  const { pathway } = parse(z.object({ pathway: z.enum(Object.keys(PATHWAYS) as [keyof typeof PATHWAYS]) }), fd);
  await db.profile.upsert({
    where: { userId: u.id },
    create: { userId: u.id, pathway, onboardedAt: new Date() },
    update: { pathway, onboardedAt: new Date() },
  });
  redirect("/assessment");
}

export async function saveStatement(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ destination: text(3000), why: text(1000), forgeStatement: text(3000) }), fd);
  await db.profile.update({ where: { userId: u.id }, data: d });
  revalidatePath("/plan");
  revalidatePath("/dashboard");
}

// ---------- FORGE assessment ----------

const assessmentSchema = z.object({
  instrument: z.enum(["FORGE_PERSONAL", "FORGE_ENTREPRENEUR", "FORGE_DRAFT"]),
  F: score, O: score, R: score, G: score, E: score,
  reflF: text(), reflO: text(), reflR: text(), reflG: text(), reflE: text(),
});

export async function saveAssessment(fd: FormData) {
  const u = await participant();
  const d = parse(assessmentSchema, fd);
  const a = await db.assessment.create({
    data: {
      userId: u.id, instrument: d.instrument,
      f: d.F, o: d.O, r: d.R, g: d.G, e: d.E,
      reflections: JSON.stringify({ F: d.reflF, O: d.reflO, R: d.reflR, G: d.reflG, E: d.reflE }),
    },
  });
  redirect(`/assessment/${a.id}`);
}

const reviseSchema = z.object({
  id: z.string(),
  F: score, O: score, R: score, G: score, E: score,
  wF: text(40), wO: text(40), wR: text(40), wG: text(40), wE: text(40),
});

/** The workbook's "Revised" column: participants re-score after reading the full anchor tables. */
export async function reviseAssessment(fd: FormData) {
  const u = await participant();
  const d = parse(reviseSchema, fd);
  const n = await db.assessment.updateMany({
    where: { id: d.id, userId: u.id },
    data: {
      revisedF: d.F, revisedO: d.O, revisedR: d.R, revisedG: d.G, revisedE: d.E,
      oneWords: JSON.stringify({ F: d.wF, O: d.wO, R: d.wR, G: d.wG, E: d.wE }),
    },
  });
  if (!n.count) throw new Error("Not found");
  revalidatePath(`/assessment/${d.id}`);
}

export async function setPriority(fd: FormData) {
  const u = await participant();
  const { pillar } = parse(z.object({ pillar: pillarKey }), fd);
  await db.profile.update({ where: { userId: u.id }, data: { priorityPillar: pillar } });
  await db.developmentGoal.updateMany({ where: { userId: u.id }, data: { isPriority: false } });
  const existing = await db.developmentGoal.findFirst({ where: { userId: u.id, pillar, status: "ACTIVE" } });
  if (existing) await db.developmentGoal.update({ where: { id: existing.id }, data: { isPriority: true } });
  else await db.developmentGoal.create({ data: { userId: u.id, pillar, isPriority: true } });
  redirect("/plan");
}

// ---------- FORGE Action Plan (development goals) ----------

const planSchema = z.object({
  pillar: pillarKey,
  whereNow: text(1500), whereWant: text(1500), oneMove: text(1000),
  segmentKey: z.string().max(4).optional(),
});

export async function saveGoal(fd: FormData) {
  const u = await participant();
  const d = parse(planSchema, fd);
  const existing = await db.developmentGoal.findFirst({ where: { userId: u.id, pillar: d.pillar, status: "ACTIVE", segmentKey: d.segmentKey ?? null } });
  if (existing) await db.developmentGoal.update({ where: { id: existing.id }, data: d });
  else await db.developmentGoal.create({ data: { ...d, userId: u.id } });
  revalidatePath("/plan");
  revalidatePath("/pathway");
}

// ---------- Discipline by Design Blueprint ----------

const commitmentSchema = z.object({
  area: z.enum(BLUEPRINT_AREAS.map((a) => a.key) as [string, ...string[]]),
  title: z.string().trim().min(1, "Pick an option or write your own").max(200),
  detail: text(1500),
  cadence: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ONCE"]),
  when: text(120),
  whenDays: text(40),
  whenTime: z.string().regex(/^(\d{2}:\d{2})?$/).default(""),
  startsOn: z.string().optional(),
});

const fmtTime = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

export async function addCommitment(fd: FormData) {
  const u = await participant();
  const { whenDays, whenTime, ...d } = parse(commitmentSchema, fd);
  if (!d.when) d.when = [whenDays, fmtTime(whenTime)].filter(Boolean).join(", ");
  await db.commitment.create({
    data: { ...d, userId: u.id, startsOn: d.startsOn ? new Date(d.startsOn + "T12:00:00") : null },
  });
  revalidatePath("/blueprint");
}

export async function removeCommitment(fd: FormData) {
  const u = await participant();
  const { id } = parse(z.object({ id: z.string() }), fd);
  await db.commitment.updateMany({ where: { id, userId: u.id }, data: { active: false } });
  revalidatePath("/blueprint");
}

// ---------- Accountability network ----------

const relSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.enum(Object.keys(RELATIONSHIP_ROLES) as [string, ...string[]]),
  purpose: text(1000),
  cadenceDays: z.coerce.number().int().min(1).max(365),
  nextCheckIn: z.string().optional(),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
});

export async function addRelationship(fd: FormData) {
  const u = await participant();
  const d = parse(relSchema, fd);
  await db.relationship.create({
    data: {
      ownerId: u.id, name: d.name, role: d.role, purpose: d.purpose, cadenceDays: d.cadenceDays,
      email: d.email || null,
      nextCheckIn: d.nextCheckIn ? new Date(d.nextCheckIn + "T12:00:00") : addDays(new Date(), d.cadenceDays),
    },
  });
  revalidatePath("/network");
}

export async function logRelationshipCheckIn(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ id: z.string(), happened: bool, lessons: text(), agreedActions: text(), occurredOn: z.string().optional() }), fd);
  const rel = await db.relationship.findFirst({ where: { id: d.id, ownerId: u.id } });
  if (!rel) throw new Error("Not found");
  const on = d.occurredOn ? new Date(d.occurredOn + "T12:00:00") : new Date();
  await db.relationshipCheckIn.create({
    data: { relationshipId: rel.id, occurredOn: on, happened: d.happened, lessons: d.lessons, agreedActions: d.agreedActions },
  });
  await db.relationship.update({ where: { id: rel.id }, data: { nextCheckIn: addDays(on, rel.cadenceDays) } });
  revalidatePath("/network");
}

export async function removeRelationship(fd: FormData) {
  const u = await participant();
  const { id } = parse(z.object({ id: z.string() }), fd);
  await db.relationship.updateMany({ where: { id, ownerId: u.id }, data: { active: false } });
  revalidatePath("/network");
}

/** Creates an invitation link. Accepting links the two accounts; it grants no access to development records. */
export async function createInvite(fd: FormData) {
  const u = await participant();
  const { id } = parse(z.object({ id: z.string() }), fd);
  const token = randomBytes(18).toString("base64url");
  const n = await db.relationship.updateMany({ where: { id, ownerId: u.id }, data: { inviteToken: token, inviteStatus: "PENDING" } });
  if (!n.count) throw new Error("Not found");
  revalidatePath("/network");
}

export async function acceptInvite(fd: FormData) {
  const u = await requireUser();
  const { token, decision } = parse(z.object({ token: z.string(), decision: z.enum(["ACCEPT", "DECLINE"]) }), fd);
  const rel = await db.relationship.findUnique({ where: { inviteToken: token } });
  if (!rel || rel.inviteStatus !== "PENDING" || rel.ownerId === u.id) redirect("/");
  await db.relationship.update({
    where: { id: rel.id },
    data: decision === "ACCEPT" ? { linkedUserId: u.id, inviteStatus: "ACCEPTED", inviteToken: null } : { inviteStatus: "DECLINED", inviteToken: null },
  });
  redirect("/");
}

// ---------- 30-day cycle ----------

const startCycleSchema = z.object({ pillar: pillarKey, focus: text(500), template: z.enum(["WORKBOOK_30", "NIRS_30"]), startDate: z.string().optional() });

export async function startCycle(fd: FormData) {
  const u = await participant();
  const d = parse(startCycleSchema, fd);
  await db.developmentCycle.updateMany({ where: { userId: u.id, status: "ACTIVE" }, data: { status: "STOPPED" } });
  await db.developmentCycle.create({
    data: { userId: u.id, pillar: d.pillar, focus: d.focus, template: d.template, startDate: d.startDate ? new Date(d.startDate + "T00:00:00") : new Date(new Date().toDateString()) },
  });
  redirect("/cycle");
}

const checkInSchema = z.object({
  status: z.enum(["DONE", "PARTIAL", "NOT_YET"]),
  note: text(1000),
  reflection: text(3000),
  shared: bool,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function logCheckIn(fd: FormData) {
  const u = await participant();
  const d = parse(checkInSchema, fd);
  const allowed = new Set(CHECKIN_TAGS.options);
  const tags = JSON.stringify(fd.getAll("tags").map(String).filter((t) => allowed.has(t)));
  const date = d.date ?? ymd();
  const cycle = await db.developmentCycle.findFirst({ where: { userId: u.id, status: "ACTIVE" } });
  await db.dailyCheckIn.upsert({
    where: { userId_date: { userId: u.id, date } },
    create: { userId: u.id, date, status: d.status, note: d.note, reflection: d.reflection, shared: d.shared, tags, cycleId: cycle?.id },
    update: { status: d.status, note: d.note, reflection: d.reflection, shared: d.shared, tags },
  });
  revalidatePath("/dashboard");
  revalidatePath("/cycle");
}

export async function saveWeek(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ id: z.string(), week: z.coerce.number().int().min(1).max(4), note: text(4000), status: z.enum(["DONE", "PARTIAL", "NOT_YET", ""]).default("") }), fd);
  const c = await db.developmentCycle.findFirst({ where: { id: d.id, userId: u.id } });
  if (!c) throw new Error("Not found");
  const notes = JSON.parse(c.weekNotes);
  const status = JSON.parse(c.weekStatus);
  notes[d.week] = d.note;
  if (d.status) status[d.week] = d.status;
  await db.developmentCycle.update({ where: { id: c.id }, data: { weekNotes: JSON.stringify(notes), weekStatus: JSON.stringify(status) } });
  revalidatePath("/cycle");
}

export async function completeCycle(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ id: z.string(), finalReview: text(6000).optional().default(""), decision: z.enum(["CONTINUE_ALONE", "GO_FURTHER", "NEW_CYCLE"]) }), fd);
  const n = await db.developmentCycle.updateMany({
    where: { id: d.id, userId: u.id },
    data: { finalReview: d.finalReview, decision: d.decision, status: "COMPLETED", completedAt: new Date() },
  });
  if (!n.count) throw new Error("Not found");
  redirect(d.decision === "NEW_CYCLE" ? "/cycle/new" : "/history");
}

// ---------- Weekly reflection ----------

export async function saveWeekly(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), built: text(), avoided: text(), nextWeek: text(), didIt: z.enum(["YES", "PARTIAL", "NOT_YET", ""]).default(""), shared: bool, held: z.string().optional() }), fd);
  const mine = new Set((await db.commitment.findMany({ where: { userId: u.id, active: true }, select: { id: true } })).map((c) => c.id));
  const { held: _ignored, ...rest } = d;
  void _ignored;
  const record = { ...rest, held: JSON.stringify(fd.getAll("held").map(String).filter((id) => mine.has(id))) };
  await db.weeklyReflection.upsert({
    where: { userId_weekOf: { userId: u.id, weekOf: d.weekOf } },
    create: { ...record, userId: u.id },
    update: record,
  });
  revalidatePath("/reflect");
}

// ---------- Private journal (never shareable) ----------

export async function addJournal(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ title: text(200), body: z.string().trim().min(1).max(20000) }), fd);
  await db.journalEntry.create({ data: { ...d, userId: u.id } });
  revalidatePath("/journal");
}

export async function deleteJournal(fd: FormData) {
  const u = await participant();
  const { id } = parse(z.object({ id: z.string() }), fd);
  await db.journalEntry.deleteMany({ where: { id, userId: u.id } });
  revalidatePath("/journal");
}

// ---------- Sharing ----------

export async function setShare(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ coachId: z.string(), scope: z.enum(Object.keys(SHARE_SCOPES) as [string, ...string[]]), on: bool }), fd);
  const assigned = await db.coachAssignment.findUnique({ where: { coachId_participantId: { coachId: d.coachId, participantId: u.id } } });
  if (!assigned?.active) throw new Error("You can only share with your assigned coach.");
  if (d.on) {
    await db.shareGrant.upsert({
      where: { ownerId_granteeId_scope: { ownerId: u.id, granteeId: d.coachId, scope: d.scope } },
      create: { ownerId: u.id, granteeId: d.coachId, scope: d.scope },
      update: {},
    });
  } else {
    await db.shareGrant.deleteMany({ where: { ownerId: u.id, granteeId: d.coachId, scope: d.scope } });
  }
  revalidatePath("/sharing");
}

export async function toggleEntryShared(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ kind: z.enum(["checkin", "weekly", "exercise"]), id: z.string(), shared: bool }), fd);
  if (d.kind === "checkin") await db.dailyCheckIn.updateMany({ where: { id: d.id, userId: u.id }, data: { shared: d.shared } });
  if (d.kind === "weekly") await db.weeklyReflection.updateMany({ where: { id: d.id, userId: u.id }, data: { shared: d.shared } });
  if (d.kind === "exercise") await db.assignedExercise.updateMany({ where: { id: d.id, participantId: u.id }, data: { responseShared: d.shared } });
  revalidatePath("/history");
  revalidatePath("/coaching");
  revalidatePath("/reflect");
}

// ---------- Settings ----------

export async function saveSettings(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({
    remindersOn: bool,
    reminderTime: z.string().regex(/^\d{2}:\d{2}$/),
    reminderDays: z.string().regex(/^[0-6](,[0-6])*$/).or(z.literal("")),
    aiEnabled: bool,
    aiRetentionDays: z.coerce.number().int().min(1).max(365),
  }), fd);
  await db.profile.update({ where: { userId: u.id }, data: d });
  // Shorten retention on existing conversations to match.
  const convos = await db.aiConversation.findMany({ where: { userId: u.id } });
  for (const c of convos) {
    const cap = addDays(c.createdAt, d.aiRetentionDays);
    if (cap < c.expiresAt) await db.aiConversation.update({ where: { id: c.id }, data: { expiresAt: cap } });
  }
  revalidatePath("/settings");
}

// ---------- EQ-i development priorities (manual entry only) ----------

export async function addEqi(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ label: z.string().trim().min(1).max(200), note: text(1500), practice: text(1500) }), fd);
  await db.eqiPriority.create({ data: { ...d, userId: u.id } });
  revalidatePath("/pathway/eqi");
}

export async function approveEqiInterpretation(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ id: z.string(), approved: bool }), fd);
  await db.eqiPriority.updateMany({ where: { id: d.id, userId: u.id }, data: { participantApproved: d.approved } });
  revalidatePath("/pathway/eqi");
}

export async function deleteEqi(fd: FormData) {
  const u = await participant();
  const { id } = parse(z.object({ id: z.string() }), fd);
  await db.eqiPriority.deleteMany({ where: { id, userId: u.id } });
  revalidatePath("/pathway/eqi");
}

// ---------- Coach-assigned exercises and session prep (participant side) ----------

export async function respondExercise(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ id: z.string(), status: z.enum(["DONE", "PARTIAL", "NOT_YET"]), response: text(6000), responseShared: bool }), fd);
  await db.assignedExercise.updateMany({ where: { id: d.id, participantId: u.id }, data: { status: d.status, response: d.response, responseShared: d.responseShared } });
  revalidatePath("/coaching");
}

export async function saveSessionPrep(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ id: z.string(), participantPrep: text(4000) }), fd);
  await db.coachingSession.updateMany({ where: { id: d.id, participantId: u.id }, data: { participantPrep: d.participantPrep } });
  revalidatePath("/coaching");
}
