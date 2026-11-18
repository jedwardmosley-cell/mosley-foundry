import "server-only";
import type { getCoachView } from "./access";
import { cyclePosition } from "./cycle";
import { daysBetween, ymd, addDays } from "./dates";

type View = Awaited<ReturnType<typeof getCoachView>>;

/** Attention flags computed only from data the participant shared. */
export function attentionFlags(v: View) {
  const flags: string[] = [];
  const s = new Set(v.scopes);
  if (s.has("PRACTICE")) {
    const recent = v.practice.filter((p) => p.date >= ymd(addDays(new Date(), -6)));
    const notYet = recent.filter((p) => p.status === "NOT_YET").length;
    if (v.cycle && v.cycle.status === "ACTIVE" && recent.length === 0) flags.push("No check-ins logged in the last 7 days");
    if (notYet >= 3) flags.push(`${notYet} "not yet" days this week: worth asking what got in the way`);
    if (v.cycle?.status === "ACTIVE" && cyclePosition(v.cycle.startDate).finished) flags.push("30 days are up and Wheel Alignment for day 30 is not done");
  }
  if (s.has("NETWORK")) {
    const overdue = v.relationships.filter((r) => r.nextCheckIn && daysBetween(new Date(), r.nextCheckIn) < 0);
    if (overdue.length) flags.push(`Overdue check-ins: ${overdue.map((r) => r.name).join(", ")}`);
    if (!v.relationships.some((r) => r.role === "ACCOUNTABILITY_PARTNER")) flags.push("No accountability partner named");
  }
  if (s.has("GOALS") && v.profile && !v.profile.priorityPillar) flags.push("No focus rule chosen yet");
  return flags;
}

/**
 * Who needs me this week: one client's reasons for attention, most pressing first, with a weight for sorting.
 * Rule-based, no AI. Uses only what the client shares plus the coach's own sessions and exercises.
 */
export function needsMe(
  v: View,
  sessions: { scheduledAt: Date }[],
  exercises: { title: string; status: string; dueOn: Date | null }[],
  now = new Date(),
): { weight: number; reasons: string[] } {
  const r: { w: number; text: string }[] = [];
  const s = new Set(v.scopes);
  const first = v.participant.name.split(" (")[0].split(" ")[0];
  if (!v.scopes.length) r.push({ w: 1, text: `${first} hasn't shared anything with you yet` });
  if (s.has("PRACTICE") && v.cycle?.status === "ACTIVE") {
    const pos = cyclePosition(v.cycle.startDate);
    const recent = v.practice.filter((p) => p.date >= ymd(addDays(now, -6)));
    const notYet = recent.filter((p) => p.status === "NOT_YET").length;
    if (pos.finished) r.push({ w: 3, text: "30 days are up and the day 30 decision isn't made" });
    else if (pos.day >= 27) r.push({ w: 1, text: `Day ${pos.day} of 30: Wheel Alignment is coming up` });
    if (!recent.length) r.push({ w: 3, text: "No check-ins in the last 7 days" });
    else if (notYet >= 3) r.push({ w: 2, text: `${notYet} "not yet" days this week` });
  }
  const overdueEx = exercises.filter((x) => x.dueOn && x.dueOn < now && (x.status === "ASSIGNED" || x.status === "NOT_YET"));
  if (overdueEx.length) r.push({ w: 2, text: overdueEx.length === 1 ? `Exercise overdue: ${overdueEx[0].title}` : `${overdueEx.length} exercises overdue` });
  const next = sessions.filter((x) => x.scheduledAt > now).sort((a, b) => +a.scheduledAt - +b.scheduledAt)[0];
  const last = sessions.filter((x) => x.scheduledAt <= now).sort((a, b) => +b.scheduledAt - +a.scheduledAt)[0];
  if (next && next.scheduledAt < addDays(now, 7)) r.push({ w: 1, text: `Session ${next.scheduledAt.toLocaleDateString("en-US", { weekday: "long" })}: worth preparing` });
  if (!next && (!last || last.scheduledAt < addDays(now, -21))) r.push({ w: 2, text: last ? "No session in 3 weeks and none booked" : "No session booked yet" });
  if (s.has("NETWORK")) {
    const overdue = v.relationships.filter((p) => p.nextCheckIn && p.nextCheckIn < now);
    if (overdue.length) r.push({ w: 1, text: `Overdue with ${overdue.map((p) => p.name).join(", ")}` });
    if (!v.relationships.some((p) => p.role === "ACCOUNTABILITY_PARTNER")) r.push({ w: 1, text: "No accountability partner named" });
  }
  r.sort((a, b) => b.w - a.w);
  return { weight: r.reduce((a, x) => a + x.w, 0), reasons: r.map((x) => x.text) };
}
