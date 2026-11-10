import "server-only";
import { db } from "./db";
import { ymd, addDays } from "./dates";

/** Everything the dashboard and history views need for the signed-in participant. Owner-only queries. */
export async function loadParticipant(userId: string) {
  const since = ymd(addDays(new Date(), -29));
  const [profile, assessment, assessments, goals, cycle, checkIns, todayCheckIn, relationships, commitments, weekly, coaches, exercises, sessions] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.assessment.findFirst({ where: { userId, isSecondOpinion: false }, orderBy: { completedAt: "desc" } }),
    db.assessment.findMany({ where: { userId, isSecondOpinion: false }, orderBy: { completedAt: "asc" } }),
    db.developmentGoal.findMany({ where: { userId, status: "ACTIVE" }, orderBy: { updatedAt: "desc" } }),
    db.developmentCycle.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { startDate: "desc" } }),
    db.dailyCheckIn.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "desc" } }),
    db.dailyCheckIn.findUnique({ where: { userId_date: { userId, date: ymd() } } }),
    db.relationship.findMany({ where: { ownerId: userId, active: true }, orderBy: { nextCheckIn: "asc" }, include: { checkIns: { orderBy: { occurredOn: "desc" }, take: 3 } } }),
    db.commitment.findMany({ where: { userId, active: true } }),
    db.weeklyReflection.findMany({ where: { userId }, orderBy: { weekOf: "desc" }, take: 8 }),
    db.coachAssignment.findMany({ where: { participantId: userId, active: true }, include: { coach: { select: { id: true, name: true } } } }),
    db.assignedExercise.findMany({ where: { participantId: userId }, orderBy: { createdAt: "desc" } }),
    db.coachingSession.findMany({ where: { participantId: userId }, orderBy: { scheduledAt: "desc" }, include: { coach: { select: { name: true } } } }),
  ]);
  return { profile, assessment, assessments, goals, cycle, checkIns, todayCheckIn, relationships, commitments, weekly, coaches, exercises, sessions };
}
