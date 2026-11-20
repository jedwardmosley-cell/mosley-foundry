import "server-only";
import { db } from "./db";
import { buildCalendar, routineEvent, icsDate, icsByDay, type CalEvent } from "./ics";
import { addDays } from "./dates";
import { RELATIONSHIP_ROLES, SEGMENTS } from "@/content/program";

export const CALENDAR_NAME = "Both Hands on the Wheel";

/**
 * The client's private calendar: their routines from the Vehicle Controls, check-ins with their people,
 * coaching sessions, and the daily check-in when they asked for it there.
 * Titles only, plus a link back. Never the journal, the plan, reflections, scores, feedback or coach notes.
 */
export async function calendarFor(userId: string, appUrl: string, now = new Date()): Promise<string> {
  const [profile, user, routines, people, sessions] = await Promise.all([
    db.profile.findUnique({ where: { userId }, select: { remindersOn: true, reminderBy: true, reminderTime: true, reminderDays: true } }),
    db.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    db.commitment.findMany({ where: { userId, active: true }, orderBy: { createdAt: "asc" } }),
    db.relationship.findMany({ where: { ownerId: userId, active: true, nextCheckIn: { not: null } }, select: { id: true, name: true, role: true, nextCheckIn: true } }),
    db.coachingSession.findMany({ where: { participantId: userId, scheduledAt: { gte: addDays(now, -30) } }, select: { id: true, scheduledAt: true, coach: { select: { name: true } } } }),
  ]);
  const events: CalEvent[] = [];

  for (const c of routines) {
    const e = routineEvent(c, appUrl);
    if (e) events.push(e);
  }

  // Each person's next check-in, on its day. An overdue one sits on today until it is logged.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const r of people) {
    const due = r.nextCheckIn! < today;
    const role = RELATIONSHIP_ROLES[r.role as keyof typeof RELATIONSHIP_ROLES];
    events.push({
      uid: `people-${r.id}@bothhands`,
      title: `Check in with ${r.name}${due ? " (overdue)" : ""}`,
      description: [role, "Log it under People in Both Hands on the Wheel, and the next one moves to its new date."].filter(Boolean).join("\n\n"),
      url: `${appUrl}/network`,
      start: { date: icsDate(due ? today : r.nextCheckIn!) },
    });
  }

  for (const s of sessions) {
    events.push({
      uid: `session-${s.id}@bothhands`,
      title: `Coaching session with ${s.coach.name.split(" (")[0]}`,
      url: `${appUrl}/coaching`,
      start: { utc: s.scheduledAt },
      minutes: 60,
      alarm: true,
    });
  }

  if (profile?.remindersOn && (profile.reminderBy === "CALENDAR" || profile.reminderBy === "BOTH")) {
    const days = profile.reminderDays.split(",").filter(Boolean).map(Number);
    if (days.length) {
      const anchor = user?.createdAt ?? now;
      events.push({
        uid: `checkin-${userId}@bothhands`,
        title: "Daily check-in",
        description: "A few taps in Both Hands on the Wheel: did I practice today?",
        url: `${appUrl}/dashboard`,
        start: { local: `${icsDate(anchor)}T${profile.reminderTime.replace(":", "")}00` },
        minutes: 5,
        rrule: days.length === 7 ? "FREQ=DAILY" : `FREQ=WEEKLY;BYDAY=${days.map((d) => icsByDay[d]).join(",")}`,
        alarm: true,
      });
    }
  }

  return buildCalendar(CALENDAR_NAME, events, now);
}

/**
 * A coach's private calendar: their coaching sessions and the cohort sessions they facilitate.
 * Names and times only, plus a link back. Never an agenda, notes or anything a client shares.
 */
export async function coachCalendarFor(coachId: string, appUrl: string, now = new Date()): Promise<string> {
  const since = addDays(now, -30);
  const [sessions, cohortSessions] = await Promise.all([
    db.coachingSession.findMany({ where: { coachId, scheduledAt: { gte: since } }, select: { id: true, scheduledAt: true, participantId: true, participant: { select: { name: true } } } }),
    db.trainingSession.findMany({
      where: { startsAt: { gte: since }, cohort: { members: { some: { userId: coachId, role: "FACILITATOR" } } } },
      select: { id: true, startsAt: true, segmentKey: true, location: true, cohort: { select: { id: true, name: true } } },
    }),
  ]);
  const events: CalEvent[] = [];
  for (const s of sessions) {
    events.push({
      uid: `coach-session-${s.id}@bothhands`,
      title: `Coaching: ${s.participant.name.replace(/\s*\((?:demo|Demo)[^)]*\)\s*$/, "").trim()}`,
      description: "Prep, notes and the wrap-up are on the client's page.",
      url: `${appUrl}/coach/${s.participantId}#sessions`,
      start: { utc: s.scheduledAt },
      minutes: 60,
      alarm: true,
    });
  }
  for (const t of cohortSessions) {
    const seg = SEGMENTS.find((x) => x.key === t.segmentKey);
    events.push({
      uid: `cohort-session-${t.id}@bothhands`,
      title: `${t.cohort.name}${seg ? `: ${seg.title}` : ""}`,
      description: t.location || undefined,
      url: `${appUrl}/coach/cohorts#cohort-${t.cohort.id}`,
      start: { utc: t.startsAt },
      minutes: 120,
      alarm: true,
    });
  }
  return buildCalendar(`${CALENDAR_NAME}: coaching`, events, now);
}
