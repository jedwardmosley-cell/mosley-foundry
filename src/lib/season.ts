import "server-only";
import { db } from "./db";
import { SEASON_LENGTH } from "@/content/program";

/** The client's active season, with its cycles in order, or null. */
export async function activeSeason(userId: string) {
  return db.season.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    include: { cycles: { orderBy: { startDate: "asc" }, select: { id: true, pillar: true, focus: true, status: true, seasonMonth: true, startDate: true, decision: true } } },
  });
}

/** The month a new cycle would be in this season, or null when the season is full. */
export function nextMonth(cycleCount: number) {
  return cycleCount < SEASON_LENGTH ? cycleCount + 1 : null;
}

/**
 * Works out the season for a cycle that is starting.
 * "new" starts a season (and closes any season still open). "continue" adds the next month to the open season.
 */
export async function seasonForNewCycle(userId: string, choice: "new" | "continue" | "") {
  if (!choice) return { seasonId: null, seasonMonth: null };
  const open = await activeSeason(userId);
  if (choice === "continue" && open) {
    const month = nextMonth(open.cycles.length);
    if (month) return { seasonId: open.id, seasonMonth: month };
  }
  if (choice === "continue" && !open) return { seasonId: null, seasonMonth: null };
  if (open) await db.season.update({ where: { id: open.id }, data: { status: "STOPPED", completedAt: new Date() } });
  const [assessment, identity, profile] = await Promise.all([
    db.assessment.findFirst({ where: { userId, isSecondOpinion: false }, orderBy: { completedAt: "desc" }, select: { id: true } }),
    db.identityProfile.findUnique({ where: { userId }, select: { becoming: true } }),
    db.profile.findUnique({ where: { userId }, select: { destination: true } }),
  ]);
  const s = await db.season.create({
    data: { userId, startAssessmentId: assessment?.id ?? null, startStatement: identity?.becoming || profile?.destination || "" },
  });
  return { seasonId: s.id, seasonMonth: 1 };
}
