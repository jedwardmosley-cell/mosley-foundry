/**
 * WEEK 1 SETUP: the pattern a 30-day cycle interrupts. Five screens, one question each, then the plan,
 * then "Who finds out?". Weeks 2 to 4 come back to the same answers. Build-team wording from the
 * author's brief: DRAFT FOR AUTHOR REVIEW.
 */
export const WEEK_ONE_STATUS: "draft" | "approved" = "draft";

export type SetupField = "situation" | "feeling" | "oldResponse" | "newResponse" | "gap";

export const SETUP_STEPS: { field: SetupField; label: string; question: string; hint: string; show?: "E" | "G" | "five"; placeholder: string }[] = [
  { field: "situation", label: "The situation", question: "When does this happen?", hint: "Name the moment as plainly as you can: where you are, who's there, what just happened.", placeholder: "When someone pushes back on my decision in a meeting" },
  { field: "feeling", label: "The feeling · E", question: "What do you feel in that moment?", hint: "Whatever words fit. There is no right answer.", show: "E", placeholder: "Heat in my chest. Like I'm being tested." },
  { field: "oldResponse", label: "The old response", question: "What do you usually do?", hint: "The thing the old you does on autopilot. No judgment here. Just name it.", placeholder: "I defend the decision right away." },
  { field: "newResponse", label: "The new response", question: "What does the person you're becoming do instead?", hint: "One thing you could do in that moment.", show: "five", placeholder: "Pause, take one breath, and ask one question before I answer." },
  { field: "gap", label: "The gap · G", question: "What makes the new response hard?", hint: "What do you need to learn or let go of?", show: "G", placeholder: "Letting go of needing to have the answer already." },
];

export const FIRST_GUESS = "First guess";
export const AI_FEELING_NOTE = "Help me with this offers words you might use. It never names the feeling for you.";
export const WHO_FINDS_OUT = {
  title: "Who finds out?",
  hint: "Pick at least one person. Setup is done when someone knows.",
  empty: "When you don't do what you said, who finds out?",
  emptyHint: "My people is empty. Add one person now. They don't need the app. You'll send them your plan by text or email.",
};
/** The roles that can be the one who finds out. */
export const FINDS_OUT_ROLES = ["ACCOUNTABILITY_PARTNER", "MENTOR", "COACH", "GROUP"] as const;
export const MENTEE_ROLES = ["MENTEE", "DIRECT_REPORT"] as const;

export const WEEK_QUESTIONS: Record<2 | 3 | 4, { title: string; question: string }> = {
  2: { title: "Week 2 · Interrupt It", question: "Was that the real situation and the real feeling?" },
  3: { title: "Week 3 · Replace It", question: "Is the new response working? Is the gap smaller?" },
  4: { title: "Week 4 · Sustain It", question: "What keeps this going after day 30?" },
};
export const REAL_CHOICES = { YES: "Yes, that's it", CLOSE: "Close", NO: "No" } as const;
export const WORKING_CHOICES = { YES: "Yes", PARTLY: "Partly", NOT_YET: "Not yet" } as const;
export const GAP_CHOICES = { SMALLER: "Smaller", SAME: "The same", BIGGER: "Bigger" } as const;

/** Lowercases the first letter, and drops a leading "When" and a final period, so answers read inside a sentence. */
function inner(s: string, drop: RegExp = /^$/) {
  const t = s.trim().replace(drop, "").replace(/[.!]+$/, "").trim();
  return t ? t[0].toLowerCase() + t.slice(1) : "";
}
const lower = (s: string) => inner(s);
const noWhen = (s: string) => inner(s, /^when\s+/i);
const noIWill = (s: string) => inner(s, /^(i will|i'll|i)\s+/i);

/** "When [situation] and I feel [feeling], I will [new response]." */
export function buildPlan(a: { situation: string; feeling: string; newResponse: string }) {
  const s = noWhen(a.situation), f = lower(a.feeling), r = noIWill(a.newResponse);
  if (!s || !r) return "";
  return `When ${s}${f ? ` and I feel ${f}` : ""}, I will ${r}.`;
}

/** The default message to the person who finds out: the situation and the new response only. */
export function shareMessage(a: { situation: string; newResponse: string; feeling?: string; oldResponse?: string; gap?: string }, add: { feeling?: boolean; old?: boolean; gap?: boolean } = {}) {
  const s = noWhen(a.situation), r = noIWill(a.newResponse);
  const lines = [`When ${s}, I'll ${r}. Check on me.`];
  if (add.feeling && a.feeling) lines.push(`In that moment I feel ${lower(a.feeling)}.`);
  if (add.old && a.oldResponse) lines.push(`What I usually do: ${lower(a.oldResponse)}.`);
  if (add.gap && a.gap) lines.push(`What makes it hard: ${lower(a.gap)}.`);
  return lines.join(" ");
}

export function menteeMessage(plan: string) {
  return `I'm working on something for the next 30 days: ${plan} Ask me how it's going.`;
}

export function weekMessage(week: 2 | 3 | 4, w: Record<string, string>, newResponse: string) {
  const r = noIWill(newResponse);
  if (week === 2) return `Week 2 of 30: ${w.real === "YES" ? "that was the real moment" : "I found the real moment"}. I'm practicing: ${r}. Check on me.`;
  if (week === 3) return `Week 3 of 30: ${r}. Is it working? ${WORKING_CHOICES[w.working as keyof typeof WORKING_CHOICES] ?? "Getting there"}. The hard part is ${(GAP_CHOICES[w.gap as keyof typeof GAP_CHOICES] ?? "about the same").toLowerCase()}. Check on me.`;
  return `Week 4 of 30. What keeps this going after day 30: ${lower(w.keep ?? "") || "still working that out"}. Thanks for checking on me.`;
}

export function dayThirtyMessage(statement: string, practiced: number) {
  return `${statement.trim()}\n\n30 days: I practiced ${practiced} of them. Thanks for checking on me.`;
}
