import "server-only";
import { db } from "./db";

/** The client's focuses in progress, slot 1 first. At most two. */
export function activeFocuses(userId: string) {
  return db.developmentCycle.findMany({ where: { userId, status: "ACTIVE" }, orderBy: [{ slot: "asc" }, { startDate: "asc" }] });
}

/** The focus being set up: the newest one whose week 1 setup isn't done, else the newest in progress. */
export async function setupCycle(userId: string) {
  return (
    (await db.developmentCycle.findFirst({ where: { userId, status: "ACTIVE", setupDoneAt: null }, orderBy: { createdAt: "desc" } })) ??
    (await db.developmentCycle.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } }))
  );
}

/** The check-ins that belong to one focus, with each day's status for that focus. */
export async function checkInsFor(cycle: { id: string; slot: number; userId: string }) {
  if (cycle.slot !== 2) return db.dailyCheckIn.findMany({ where: { cycleId: cycle.id }, orderBy: { date: "asc" } });
  const rows = await db.dailyCheckIn.findMany({ where: { cycle2Id: cycle.id }, orderBy: { date: "asc" } });
  return rows.filter((r) => r.status2).map((r) => ({ ...r, status: r.status2, cycleId: cycle.id }));
}
