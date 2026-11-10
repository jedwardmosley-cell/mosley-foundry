import "server-only";
import { db } from "./db";
import type { CurrentUser } from "./auth";

/**
 * Authorization rules. Every read of another person's data goes through this file.
 *
 *  1. A participant owns their records. Only they can read or change them.
 *  2. A coach assignment grants NOTHING by itself except the participant's name.
 *     The participant grants scopes to that coach (ShareGrant).
 *  3. Free-text reflections need BOTH the REFLECTIONS scope AND the individual entry marked shared.
 *  4. Journal entries and AI conversations have no sharing path at all.
 *  5. Admins and sponsors see aggregate program data and attendance, never development records.
 */
export const SHARE_SCOPES = {
  GOALS: "Development priority, goals, FORGE Statement and destination",
  ASSESSMENT: "FORGE scores",
  PRACTICE: "Practice completion (Done / Partial / Not yet) and cycle progress",
  REFLECTIONS: "Reflections I mark as shared",
  BLUEPRINT: "Discipline by Design Blueprint",
  NETWORK: "Accountability relationships (names, roles, check-in cadence)",
  EQI: "EQ-i development priorities I approve",
} as const;
export type ShareScope = keyof typeof SHARE_SCOPES;

export class ForbiddenError extends Error {
  constructor(msg = "Not permitted") {
    super(msg);
  }
}

export async function isActiveCoachOf(coachId: string, participantId: string) {
  const a = await db.coachAssignment.findUnique({
    where: { coachId_participantId: { coachId, participantId } },
  });
  return !!a?.active;
}

/** Scopes the participant has granted to this viewer. Empty set when not an active coach. */
export async function grantedScopes(viewer: CurrentUser, participantId: string): Promise<Set<ShareScope>> {
  if (viewer.id === participantId) return new Set(Object.keys(SHARE_SCOPES) as ShareScope[]);
  if (viewer.role !== "COACH") return new Set();
  if (!(await isActiveCoachOf(viewer.id, participantId))) return new Set();
  const grants = await db.shareGrant.findMany({ where: { ownerId: participantId, granteeId: viewer.id } });
  return new Set(grants.map((g) => g.scope as ShareScope));
}

export async function audit(actor: CurrentUser, action: string, targetUserId?: string, detail = "") {
  await db.auditEvent.create({ data: { actorId: actor.id, action, targetUserId, detail } });
}

/**
 * The only function that returns a participant's development data to someone else.
 * Each field is loaded only if its scope is granted, so unshared data never leaves the database query.
 */
export async function getCoachView(coach: CurrentUser, participantId: string) {
  if (coach.role !== "COACH" || !(await isActiveCoachOf(coach.id, participantId))) {
    throw new ForbiddenError("You are not this participant's coach.");
  }
  const scopes = await grantedScopes(coach, participantId);
  const has = (s: ShareScope) => scopes.has(s);
  const participant = await db.user.findUniqueOrThrow({
    where: { id: participantId },
    select: { id: true, name: true, isDemo: true },
  });

  const [profile, goals, assessment, cycle, checkIns, weekly, commitments, relationships, eqi] = await Promise.all([
    has("GOALS")
      ? db.profile.findUnique({ where: { userId: participantId }, select: { pathway: true, destination: true, why: true, forgeStatement: true, priorityPillar: true } })
      : null,
    has("GOALS") ? db.developmentGoal.findMany({ where: { userId: participantId, status: "ACTIVE" } }) : [],
    has("ASSESSMENT")
      ? db.assessment.findFirst({ where: { userId: participantId, isSecondOpinion: false }, orderBy: { completedAt: "desc" },
          select: { instrument: true, f: true, o: true, r: true, g: true, e: true, revisedF: true, revisedO: true, revisedR: true, revisedG: true, revisedE: true, completedAt: true } })
      : null,
    has("PRACTICE")
      ? db.developmentCycle.findFirst({ where: { userId: participantId }, orderBy: { startDate: "desc" },
          select: { id: true, template: true, pillar: true, focus: true, startDate: true, status: true, weekStatus: true, decision: true, completedAt: true } })
      : null,
    has("PRACTICE") || has("REFLECTIONS")
      ? db.dailyCheckIn.findMany({ where: { userId: participantId }, orderBy: { date: "desc" }, take: 30,
          select: { date: true, status: true, shared: true, reflection: true, note: true, tags: true } })
      : [],
    has("REFLECTIONS")
      ? db.weeklyReflection.findMany({ where: { userId: participantId, shared: true }, orderBy: { weekOf: "desc" }, take: 6 })
      : [],
    has("BLUEPRINT") ? db.commitment.findMany({ where: { userId: participantId, active: true } }) : [],
    has("NETWORK")
      ? db.relationship.findMany({ where: { ownerId: participantId, active: true },
          select: { id: true, name: true, role: true, cadenceDays: true, nextCheckIn: true, checkIns: { orderBy: { occurredOn: "desc" }, take: 1, select: { occurredOn: true, happened: true } } } })
      : [],
    has("EQI") ? db.eqiPriority.findMany({ where: { userId: participantId, participantApproved: true } }) : [],
  ]);

  // Rule 3: strip reflection text unless REFLECTIONS granted and the entry is marked shared.
  const practice = checkIns.map((c) => ({
    date: c.date,
    status: has("PRACTICE") ? c.status : null,
    tags: has("PRACTICE") ? (JSON.parse(c.tags || "[]") as string[]) : [],
    reflection: has("REFLECTIONS") && c.shared ? c.reflection : null,
    note: has("REFLECTIONS") && c.shared ? c.note : null,
  }));

  await audit(coach, "coach.view", participantId, [...scopes].join(","));
  return { participant, scopes: [...scopes], profile, goals, assessment, cycle, practice, weekly, commitments, relationships, eqi };
}

/** Coach-side data the coach created: sessions and assigned exercises. Participant responses honor responseShared. */
export async function getCoachWork(coach: CurrentUser, participantId: string) {
  if (!(await isActiveCoachOf(coach.id, participantId))) throw new ForbiddenError();
  const [sessions, exercises] = await Promise.all([
    db.coachingSession.findMany({ where: { coachId: coach.id, participantId }, orderBy: { scheduledAt: "desc" } }),
    db.assignedExercise.findMany({ where: { coachId: coach.id, participantId }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    sessions,
    exercises: exercises.map((x) => ({ ...x, response: x.responseShared ? x.response : null })),
  };
}
