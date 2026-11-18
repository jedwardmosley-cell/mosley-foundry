/**
 * The sentence at the top of the Dashboard, written by rule. No AI, no counts and no praise:
 * it says where the client is in their 30 days, nothing more.
 * Build-team wording in the house style: DRAFT FOR AUTHOR REVIEW.
 */
export type Mood = "start" | "ready" | "decide";
export type Headline = { mood: Mood; label: string; title: string; line: string };

export const MOOD_LABEL: Record<Mood, string> = { start: "My 30 days", ready: "Ready", decide: "Decide" };

export function todayHeadline(o: { cycle: boolean; finished: boolean; day: number }): Headline {
  if (!o.cycle) return { mood: "ready", label: MOOD_LABEL.ready, title: "Ready when you are.", line: "Put one or two things on your windshield and start your 30 days." };
  if (o.finished) return { mood: "decide", label: MOOD_LABEL.decide, title: "Day 30. Time to decide.", line: "Time for a wheel alignment. Look back at your 30 days and choose what comes next." };
  return { mood: "start", label: MOOD_LABEL.start, title: `Day ${o.day} of 30.`, line: "Practice your plan, then check in. A few taps is enough." };
}
