import "server-only";
import { db } from "./db";
import { cyclePosition } from "./cycle";
import { scheduleOf, daysToText, timeToText } from "./schedule";
import { localNow, WEEKLY_SLOTS, type WeeklySlot, type WeeklyDigest } from "./reminders";
import { NIRS_WEEKS } from "@/content/program";
import { WEEK_QUESTIONS } from "@/content/weekOne";

/** Noon UTC on a YYYY-MM-DD day, plus n days: safe date arithmetic whatever the server's time zone. */
const dayAt = (ymd: string, n = 0) => new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10) + n, 12));

/**
 * What goes in one client's weekly email: the week of their 30 days, their routines,
 * check-ins due this week and their next coaching session. Times shown in their own time zone.
 */
export async function weeklyDigestFor(userId: string, name: string, timezone: string, slot: string, appUrl: string, now = new Date()): Promise<WeeklyDigest> {
  const s = WEEKLY_SLOTS[slot as WeeklySlot] ?? WEEKLY_SLOTS.SUN_PM;
  const today = localNow(timezone, now).ymd;
  const start = dayAt(today, s.startsTomorrow ? 1 : 0);
  const end = dayAt(today, (s.startsTomorrow ? 1 : 0) + 7);
  const weekday = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", timeZone: timezone });

  const [cycle, routines, people, session] = await Promise.all([
    db.developmentCycle.findFirst({ where: { userId, status: "ACTIVE" }, select: { startDate: true } }),
    db.commitment.findMany({ where: { userId, active: true, cadence: { in: ["DAILY", "WEEKLY"] } }, orderBy: { createdAt: "asc" }, take: 8 }),
    db.relationship.findMany({ where: { ownerId: userId, active: true, nextCheckIn: { not: null, lt: end } }, select: { name: true, nextCheckIn: true }, orderBy: { nextCheckIn: "asc" }, take: 6 }),
    db.coachingSession.findFirst({ where: { participantId: userId, scheduledAt: { gte: now, lt: end } }, orderBy: { scheduledAt: "asc" }, select: { scheduledAt: true, coach: { select: { name: true } } } }),
  ]);

  let c: WeeklyDigest["cycle"] = null;
  if (cycle) {
    // cyclePosition counts calendar days on the server's clock; compare like with like.
    const startLocal = new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const pos = cyclePosition(cycle.startDate, startLocal);
    if (pos.finished) c = { heading: "Day 30: time to decide what's next" };
    else {
      const phase = NIRS_WEEKS.find((w) => w.week === pos.week)?.phase ?? "";
      c = { heading: `Week ${pos.week} of your 30 days: ${phase}`, question: pos.week >= 2 ? WEEK_QUESTIONS[pos.week as 2 | 3 | 4].question : undefined };
    }
  }

  return {
    name,
    cycle: c,
    routines: routines.map((r) => {
      const sc = scheduleOf(r);
      const when = [sc.days.length ? daysToText(sc.days).replace(/^Every day$/, "every day") : "", timeToText(sc.time)].filter(Boolean).join(", ");
      return { title: r.title, when };
    }),
    people: people.map((p) => ({ name: p.name, when: p.nextCheckIn! < start ? "overdue" : weekday(p.nextCheckIn!) })),
    session: session
      ? `${weekday(session.scheduledAt)} at ${session.scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }).replace(" AM", " am").replace(" PM", " pm")} with ${session.coach.name.split(" (")[0]}`
      : null,
    appUrl,
  };
}
