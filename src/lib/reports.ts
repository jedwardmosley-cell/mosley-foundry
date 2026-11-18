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

/**
 * Cohort session prep: what the group is working on and how practice is going, as totals only. Behavior totals
 * appear only for groups at or above MIN_GROUP; smaller groups get the program content and nothing about people.
 * No names, no written text, nothing about one person.
 */
export async function cohortPulse(cohortId: string, now = new Date()) {
  const r = await cohortReport(cohortId);
  const ids = r.cohort.members.map((m) => m.userId);
  const upcoming = r.cohort.sessions.find((s) => s.startsAt > now);
  const segmentKey = upcoming?.segmentKey ?? r.cohort.sessions.at(-1)?.segmentKey ?? SEGMENTS[0].key;
  const segment = SEGMENTS.find((s) => s.key === segmentKey) ?? SEGMENTS[0];
  const lines: string[] = [
    `Group: ${r.n} participants`,
    `This session: segment ${segment.key}, ${segment.title}${upcoming ? `, on ${upcoming.startsAt.toDateString()}` : " (the most recent; no later session is scheduled)"}`,
    `Segment summary: ${segment.summary}`,
    `Segment FORGE rules: ${segment.pillars.join(", ")}`,
    `Segment practice: ${segment.practice.text}`,
  ];
  if (r.small) {
    lines.push(`The group has fewer than ${MIN_GROUP} people, so no totals about their practice are shared.`);
    return { segmentKey, small: true, text: lines.join("\n") };
  }
  const since = ymd(addDays(now, -14));
  const [cycles, checkIns, profiles, assessments] = await Promise.all([
    db.developmentCycle.findMany({ where: { userId: { in: ids }, status: "ACTIVE" }, select: { pillar: true } }),
    db.dailyCheckIn.findMany({ where: { userId: { in: ids }, date: { gte: since } }, select: { userId: true, status: true, tags: true } }),
    db.profile.findMany({ where: { userId: { in: ids } }, select: { priorityPillar: true } }),
    db.assessment.findMany({ where: { userId: { in: ids }, isSecondOpinion: false }, orderBy: { completedAt: "desc" }, select: { userId: true, f: true, o: true, r: true, g: true, e: true, revisedF: true, revisedO: true, revisedR: true, revisedG: true, revisedE: true, completedAt: true } }),
  ]);
  const count = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ");
  if (cycles.length) lines.push(`Active 30-day focuses by FORGE rule: ${count(cycles.map((c) => c.pillar))}`);
  const prio = profiles.map((p) => p.priorityPillar).filter(Boolean) as string[];
  if (prio.length) lines.push(`Chosen priority rule: ${count(prio)}`);
  const active = new Set(checkIns.map((c) => c.userId)).size;
  lines.push(`Daily check-ins, last 14 days: ${active} of ${r.n} people checked in at least once`);
  if (checkIns.length) {
    lines.push(`Check-in answers, last 14 days: ${checkIns.filter((c) => c.status === "DONE").length} done, ${checkIns.filter((c) => c.status === "PARTIAL").length} partial, ${checkIns.filter((c) => c.status === "NOT_YET").length} not yet`);
    const tags = checkIns.flatMap((c) => JSON.parse(c.tags || "[]") as string[]);
    if (tags.length) lines.push(`Where practice happened (tags): ${count(tags)}`);
  }
  const latest = new Map<string, (typeof assessments)[number]>();
  for (const a of assessments) if (!latest.has(a.userId)) latest.set(a.userId, a);
  if (latest.size >= MIN_GROUP) {
    const avg = (k: "f" | "o" | "r" | "g" | "e", rk: "revisedF" | "revisedO" | "revisedR" | "revisedG" | "revisedE") =>
      ([...latest.values()].reduce((s, a) => s + (a[rk] ?? a[k]), 0) / latest.size).toFixed(1);
    lines.push(`Average FORGE self-ratings (1 to 5, self-rated): F ${avg("f", "revisedF")}, O ${avg("o", "revisedO")}, R ${avg("r", "revisedR")}, G ${avg("g", "revisedG")}, E ${avg("e", "revisedE")}`);
  }
  const prev = r.bySegment.filter((s) => s.startsAt && s.startsAt <= now).at(-1);
  if (prev?.pct != null) lines.push(`Attendance at the last session: ${prev.pct}%`);
  return { segmentKey, small: false, text: lines.join("\n") };
}
