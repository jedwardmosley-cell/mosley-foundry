/**
 * The sentence at the top of Today, written by rule from the client's own check-ins. No AI.
 * Build-team wording in the house style: DRAFT FOR AUTHOR REVIEW.
 */
export type Mood = "start" | "strong" | "building" | "care" | "ready" | "decide";
export type Headline = { mood: Mood; label: string; title: string; line: string };

export const MOOD_LABEL: Record<Mood, string> = {
  start: "Starting", strong: "Strong", building: "Building", care: "Needs care", ready: "Ready", decide: "Decide",
};

/** practiced = Done or Partial days in the window; window = the last 10 days of this cycle, or fewer early on. */
export function todayHeadline(o: { cycle: boolean; finished: boolean; day: number; practiced: number; window: number }): Headline {
  const h = (mood: Mood, title: string, line: string): Headline => ({ mood, label: MOOD_LABEL[mood], title, line });
  if (!o.cycle) return h("ready", "Ready when you are.", "Pick one behavior and start your 30 days.");
  if (o.finished) return h("decide", "Day 30. Time to decide.", "Look back at your 30 days and choose what comes next.");
  const { practiced: p, window: w } = o;
  if (w <= 2) return h("start", `Day ${o.day}. You've started.`, "Check in each day. Two minutes is enough.");
  const r = p / w;
  if (r >= 0.8) return h("strong", "You're showing up.", `You practiced ${p} of the last ${w} days. Keep it going.`);
  if (r >= 0.5) return h("building", "Building, day by day.", `${p} of the last ${w} days. One more today makes it ${p + 1}.`);
  if (p > 0) return h("care", "Pick it back up today.", `${p} of the last ${w} days so far. A missed day is just information.`);
  return h("care", "Today is a fresh start.", `No check-ins in the last ${w} days. Two minutes today counts.`);
}
