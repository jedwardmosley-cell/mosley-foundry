import "server-only";
import { db } from "./db";
import { SEGMENTS } from "@/content/program";
import { addDays, ymd } from "./dates";

/** Minimum group size before any percentage is shown. Smaller groups could identify individuals. */
export const MIN_GROUP = 5;

export function pct(n: number, d: number) {
  if (d < MIN_GROUP) return null;
  return Math.round((n / d) * 100);
}

/** Aggregate program metrics for a cohort. Never returns individual development records. */
export async function cohortReport(cohortId: string) {
  const cohort = await db.cohort.findUniqueOrThrow({
    where: { id: cohortId },
    include: { members: { where: { role: "PARTICIPANT" } }, sessions: { include: { attendance: true }, orderBy: { startsAt: "asc" } } },
  });
  const ids = cohort.members.map((m) => m.userId);
  const n = ids.length;
  const bySegment = SEGMENTS.map((s) => {
    const sess = cohort.sessions.find((x) => x.segmentKey === s.key);
    const present = sess?.attendance.filter((a) => a.status === "PRESENT" && ids.includes(a.userId)).length ?? 0;
    return { key: s.key, title: s.title, startsAt: sess?.startsAt ?? null, present, pct: pct(present, n) };
  });
  const completed = ids.filter((id) => cohort.sessions.every((s) => s.attendance.some((a) => a.userId === id && a.status === "PRESENT"))).length;
  const last = cohort.sessions.at(-1)?.startsAt;
  let reinforcing = 0;
  if (last) {
    const from = ymd(addDays(last, 1));
    const to = ymd(addDays(last, cohort.reinforceDays));
    const rows = await db.dailyCheckIn.groupBy({ by: ["userId"], where: { userId: { in: ids }, date: { gte: from, lte: to } } });
    reinforcing = rows.length;
  }
  return { cohort, n, bySegment, completed, completedPct: pct(completed, n), reinforcing, reinforcingPct: pct(reinforcing, n), small: n < MIN_GROUP };
}
