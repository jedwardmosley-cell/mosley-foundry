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
    if (v.cycle?.status === "ACTIVE" && cyclePosition(v.cycle.startDate).finished) flags.push("30 days are up and the Day 30 review is not done");
  }
  if (s.has("NETWORK")) {
    const overdue = v.relationships.filter((r) => r.nextCheckIn && daysBetween(new Date(), r.nextCheckIn) < 0);
    if (overdue.length) flags.push(`Overdue check-ins: ${overdue.map((r) => r.name).join(", ")}`);
    if (!v.relationships.some((r) => r.role === "ACCOUNTABILITY_PARTNER")) flags.push("No accountability partner named");
  }
  if (s.has("GOALS") && v.profile && !v.profile.priorityPillar) flags.push("No development priority chosen");
  return flags;
}
