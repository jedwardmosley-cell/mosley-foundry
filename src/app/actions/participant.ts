"use server";
import { FORGE_LINES, withPrefix } from "@/content/forgeLines";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { bool, parse, pillarKey, score, text } from "@/lib/validation";
import { addDays, ymd } from "@/lib/dates";
import { PATHWAYS, BLUEPRINT_AREAS, RELATIONSHIP_ROLES, DAY30_DECISIONS, SEASON_DECISIONS, type Day30Decision } from "@/content/program";
import { seasonForNewCycle } from "@/lib/season";
import { SHARE_SCOPES } from "@/lib/access";
import { CHECKIN_TAGS } from "@/content/options";

const participant = () => requireUser("PARTICIPANT");
/** True when the form was sent from the guided first session, which takes the client on to the next step. */
const fromStart = (fd: FormData) => fd.get("next") === "/start";

// ---------- Onboarding and profile ----------

export async function choosePathway(fd: FormData) {
  const u = await participant();
  const { pathway } = parse(z.object({ pathway: z.enum(Object.keys(PATHWAYS) as [keyof typeof PATHWAYS]) }), fd);
  const before = await db.profile.findUnique({ where: { userId: u.id }, select: { onboardedAt: true } });
  await db.profile.upsert({
    where: { userId: u.id },
    create: { userId: u.id, pathway, onboardedAt: new Date() },
    update: { pathway, onboardedAt: new Date() },
  });
  // New clients go into the guided first session. Someone changing pathway later goes back to the assessment.
  redirect(before?.onboardedAt ? "/assessment" : "/start");
}

export async function saveStatement(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ destination: text(3000), lineO: text(1500), why: text(1500), lineG: text(1500), lineE: text(1500), forgeStatement: text(3000) }), fd);
  // Each line's fixed start ("I am", "I notice", ...) is added here. An older answer that never had it is saved as written.
  for (const l of FORGE_LINES) if (fd.get(`${l.field}__p`) === "1") d[l.field] = withPrefix(l.prefix, d[l.field]);
  await db.profile.update({ where: { userId: u.id }, data: d });
  revalidatePath("/plan");
  revalidatePath("/dashboard");
  if (fromStart(fd)) redirect("/start?step=2");
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
  if (fd.get("next") === "/season") redirect("/season");
  redirect(`/assessment/${a.id}${fromStart(fd) ? "?next=start" : ""}`);
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
  redirect(fromStart(fd) ? "/start?step=3" : "/blueprint#one-move");
}

// ---------- FORGE plan (development goals) ----------

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
  revalidatePath("/blueprint");
  revalidatePath("/pathway");
}

// ---------- Discipline by Design blueprint ----------

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
  if (fromStart(fd)) redirect("/start?step=3");
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
  if (fromStart(fd)) redirect("/start?step=3");
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

const startCycleSchema = z.object({ pillar: pillarKey, focus: text(500), template: z.enum(["WORKBOOK_30", "NIRS_30"]), startDate: z.string().optional(), season: z.enum(["new", "continue", ""]).default(""), role: text(80) });

export async function startCycle(fd: FormData) {
  const u = await participant();
  const { season, role, ...d } = parse(startCycleSchema, fd);
  // One role per 30 days. A new role here also becomes the role in Who I am.
  if (role) await db.identityProfile.updateMany({ where: { userId: u.id, NOT: { role } }, data: { role } });
  await db.developmentCycle.updateMany({ where: { userId: u.id, status: "ACTIVE" }, data: { status: "STOPPED" } });
  const s = await seasonForNewCycle(u.id, season);
  // Month 2 or 3 of a season starts from last month's week 1 answers. The client reviews them in
  // week 1 setup and sends the plan again; last month's person is already picked.
  const last = s.seasonId && s.seasonMonth && s.seasonMonth > 1
    ? await db.developmentCycle.findFirst({ where: { userId: u.id, seasonId: s.seasonId }, orderBy: { startDate: "desc" } })
    : null;
  const carried = last && (last.situation || last.newResponse)
    ? {
        situation: last.situation, feeling: last.feeling, oldResponse: last.oldResponse, newResponse: last.newResponse || d.focus, gap: last.gap, plan: last.plan,
        firstGuess: JSON.stringify({ situation: last.situation, feeling: last.feeling, oldResponse: last.oldResponse, newResponse: last.newResponse, gap: last.gap }),
        partnerId: last.partnerId, shareFeeling: last.shareFeeling, shareOld: last.shareOld, shareGap: last.shareGap,
      }
    : { newResponse: d.focus };
  await db.developmentCycle.create({
    data: { userId: u.id, role, seasonId: s.seasonId, seasonMonth: s.seasonMonth, pillar: d.pillar, focus: carried.newResponse || d.focus, template: d.template, startDate: d.startDate ? new Date(d.startDate + "T00:00:00") : new Date(new Date().toDateString()), ...carried },
  });
  // Week 1 setup comes next: the situation, the feeling, the old and new response, the gap, then who finds out.
  redirect("/cycle/setup?step=1");
}

const checkInSchema = z.object({
  status: z.enum(["DONE", "PARTIAL", "NOT_YET"]),
  note: text(1000),
  reflection: text(3000),
  shared: bool,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  identityActed: z.enum(["YES", "PARTLY", "NOT_YET", ""]).default(""),
  identityNote: text(500),
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
    create: { userId: u.id, date, status: d.status, note: d.note, reflection: d.reflection, shared: d.shared, tags, identityActed: d.identityActed, identityNote: d.identityNote, cycleId: cycle?.id },
    update: { status: d.status, note: d.note, reflection: d.reflection, shared: d.shared, tags, identityActed: d.identityActed, identityNote: d.identityNote },
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
  const d = parse(z.object({ id: z.string(), finalReview: text(6000).optional().default(""), decision: z.enum(Object.keys(DAY30_DECISIONS) as [Day30Decision, ...Day30Decision[]]) }), fd);
  const c = await db.developmentCycle.findFirst({ where: { id: d.id, userId: u.id } });
  if (!c) throw new Error("Not found");
  await db.developmentCycle.update({
    where: { id: c.id },
    data: { finalReview: d.finalReview, decision: d.decision, status: "COMPLETED", completedAt: new Date() },
  });
  revalidatePath("/", "layout");
  const q = (x: Record<string, string>) => new URLSearchParams(x).toString();
  if (d.decision === "NEXT_SAME") redirect(`/cycle/new?${q({ season: "continue", pillar: c.pillar, focus: c.focus })}`);
  if (d.decision === "NEXT_OTHER") redirect(`/cycle/new?${q({ season: "continue" })}`);
  if (d.decision === "END_SEASON" || d.decision === "SEASON_REVIEW") redirect("/season");
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
  await saveLookAgain(u.id, fd);
  revalidatePath("/reflect");
}

const lookSchema = z.object({
  look_week: z.coerce.number().int().min(2).max(4),
  look_real: z.enum(["YES", "CLOSE", "NO", ""]).default(""),
  look_situation: text(1500),
  look_feeling: text(1500),
  look_working: z.enum(["YES", "PARTLY", "NOT_YET", ""]).default(""),
  look_gap: z.enum(["SMALLER", "SAME", "BIGGER", ""]).default(""),
  look_note: text(1500),
  look_keep: text(1500),
  look_routine: bool,
});

/**
 * Weeks 2 to 4 of the 30 days come back to the week 1 answers. Week 2 can change the situation or
 * the feeling; the first guess is kept. Week 4 can put what keeps it going onto My road.
 */
async function saveLookAgain(userId: string, fd: FormData) {
  if (!fd.get("look_week")) return;
  const d = lookSchema.safeParse(Object.fromEntries(fd));
  if (!d.success) return;
  const c = await db.developmentCycle.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { startDate: "desc" } });
  if (!c) return;
  const w = d.data;
  const answers = JSON.parse(c.weekAnswers || "{}") as Record<string, Record<string, string | boolean>>;
  const prev = answers[String(w.look_week)] ?? {};
  const data: Record<string, string> = {};
  if (w.look_week === 2) {
    answers["2"] = { ...prev, real: w.look_real, note: w.look_note };
    if (w.look_situation && w.look_situation !== c.situation) data.situation = w.look_situation;
    if (w.look_feeling && w.look_feeling !== c.feeling) data.feeling = w.look_feeling;
  } else if (w.look_week === 3) {
    answers["3"] = { ...prev, working: w.look_working, gap: w.look_gap, note: w.look_note };
  } else {
    answers["4"] = { ...prev, keep: w.look_keep };
    if (w.look_routine && w.look_keep) {
      const title = w.look_keep.slice(0, 200), detail = "From my 30 days";
      const exists = await db.commitment.findFirst({ where: { userId, active: true, title, detail } });
      if (!exists) await db.commitment.create({ data: { userId, area: "ROUTINES", title, detail, cadence: "WEEKLY" } });
    }
  }
  await db.developmentCycle.update({ where: { id: c.id }, data: { ...data, weekAnswers: JSON.stringify(answers) } });
}

/** "Not this week": the send prompt after a weekly reflection goes away for that week. */
export async function skipWeekSend(fd: FormData) {
  const u = await participant();
  const week = String(fd.get("week") ?? "");
  const c = await db.developmentCycle.findFirst({ where: { userId: u.id, status: { in: ["ACTIVE", "COMPLETED"] } }, orderBy: { startDate: "desc" } });
  if (!c || !["2", "3", "4", "30"].includes(week)) return;
  const answers = JSON.parse(c.weekAnswers || "{}") as Record<string, Record<string, unknown>>;
  answers[week] = { ...(answers[week] ?? {}), skipSend: true };
  await db.developmentCycle.update({ where: { id: c.id }, data: { weekAnswers: JSON.stringify(answers) } });
  revalidatePath("/reflect");
  revalidatePath("/cycle");
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

/** Opting in or out of the EQ-i layer. Opting out hides it and keeps the entries. */
export async function setEqiEnabled(fd: FormData) {
  const u = await participant();
  const { on } = parse(z.object({ on: bool }), fd);
  await db.profile.update({ where: { userId: u.id }, data: { eqiEnabled: on } });
  revalidatePath("/pathway/eqi");
  revalidatePath("/pathway");
  revalidatePath("/dashboard");
}

const eqiPillar = z.enum(["F", "O", "R", "G", "E", ""]).default("");

export async function addEqi(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ label: z.string().trim().min(1).max(200), note: text(1500), practice: text(1500), pillar: eqiPillar }), fd);
  await db.eqiPriority.create({ data: { label: d.label, note: d.note, practice: d.practice, pillar: d.pillar || null, userId: u.id } });
  await db.profile.update({ where: { userId: u.id }, data: { eqiEnabled: true } });
  revalidatePath("/pathway/eqi");
}

export async function updateEqi(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ id: z.string(), practice: text(1500), pillar: eqiPillar }), fd);
  await db.eqiPriority.updateMany({ where: { id: d.id, userId: u.id }, data: { practice: d.practice, pillar: d.pillar || null } });
  revalidatePath("/pathway/eqi");
  revalidatePath("/dashboard");
}

/** Puts the practice for an EQ-i priority into the blueprint as a daily routine. */
export async function addEqiToBlueprint(fd: FormData) {
  const u = await participant();
  const { id } = parse(z.object({ id: z.string() }), fd);
  const e = await db.eqiPriority.findFirst({ where: { id, userId: u.id } });
  if (!e || !e.practice) throw new Error("Add a practice first.");
  const detail = `From my EQ-i priority: ${e.label}`;
  const exists = await db.commitment.findFirst({ where: { userId: u.id, active: true, title: e.practice, detail } });
  if (!exists) await db.commitment.create({ data: { userId: u.id, area: "ROUTINES", title: e.practice, detail, cadence: "DAILY" } });
  redirect("/blueprint");
}

/** One step to share an EQ-i priority: approves the item and turns on EQ-i sharing for the assigned coach. */
export async function shareEqi(fd: FormData) {
  const u = await participant();
  const { id } = parse(z.object({ id: z.string() }), fd);
  const coaches = await db.coachAssignment.findMany({ where: { participantId: u.id, active: true } });
  if (!coaches.length) throw new Error("No coach is assigned to you yet.");
  const n = await db.eqiPriority.updateMany({ where: { id, userId: u.id }, data: { participantApproved: true } });
  if (!n.count) throw new Error("Not found");
  for (const c of coaches) {
    await db.shareGrant.upsert({
      where: { ownerId_granteeId_scope: { ownerId: u.id, granteeId: c.coachId, scope: "EQI" } },
      create: { ownerId: u.id, granteeId: c.coachId, scope: "EQI" },
      update: {},
    });
  }
  revalidatePath("/pathway/eqi");
  revalidatePath("/sharing");
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

// ---------- Seasons ----------

/** Closes the season with the client's review and choice. Their cycles and scores are kept. */
export async function completeSeason(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ id: z.string(), review: text(6000).optional().default(""), decision: z.enum(Object.keys(SEASON_DECISIONS) as [keyof typeof SEASON_DECISIONS, ...(keyof typeof SEASON_DECISIONS)[]]) }), fd);
  const n = await db.season.updateMany({ where: { id: d.id, userId: u.id }, data: { review: d.review, decision: d.decision, status: "COMPLETED", completedAt: new Date() } });
  if (!n.count) throw new Error("Not found");
  // Any cycle still open in the season ends with it.
  await db.developmentCycle.updateMany({ where: { seasonId: d.id, userId: u.id, status: "ACTIVE" }, data: { status: "STOPPED" } });
  revalidatePath("/", "layout");
  redirect(d.decision === "NEW_SEASON" ? "/cycle/new?season=new" : "/dashboard");
}

// ---------- Start over ----------

export type StartOverState = { error?: string } | undefined;

/**
 * The client erases their own development records and begins again from the pathway choice.
 * Kept: the login, settings, coach assignments and sharing choices, and records that belong to
 * the coach or the program (sessions, assigned exercises, cohort attendance, the audit log).
 * Only the client can do this, and only to their own account.
 */
export async function startOver(_prev: StartOverState, fd: FormData): Promise<StartOverState> {
  const u = await participant();
  if (String(fd.get("confirm") ?? "").trim().toLowerCase() !== "start over") return { error: 'Type "start over" to confirm.' };
  const userId = u.id;
  await db.$transaction([
    db.dailyCheckIn.deleteMany({ where: { userId } }),
    db.developmentCycle.deleteMany({ where: { userId } }),
    db.season.deleteMany({ where: { userId } }),
    db.weeklyReflection.deleteMany({ where: { userId } }),
    db.journalEntry.deleteMany({ where: { userId } }),
    db.commitment.deleteMany({ where: { userId } }),
    db.relationship.deleteMany({ where: { ownerId: userId } }),
    db.developmentGoal.deleteMany({ where: { userId } }),
    db.assessment.deleteMany({ where: { userId } }),
    db.eqiPriority.deleteMany({ where: { userId } }),
    db.identityHistory.deleteMany({ where: { userId } }),
    db.identityProfile.deleteMany({ where: { userId } }),
    db.aiConversation.deleteMany({ where: { userId } }),
    db.profile.update({
      where: { userId },
      data: { pathway: "PERSONAL", destination: "", lineO: "", why: "", lineG: "", lineE: "", forgeStatement: "", priorityPillar: null, eqiEnabled: false, onboardedAt: null },
    }),
    db.auditEvent.create({ data: { actorId: userId, action: "participant.start_over", targetUserId: userId } }),
  ]);
  revalidatePath("/", "layout");
  redirect("/onboarding");
}
