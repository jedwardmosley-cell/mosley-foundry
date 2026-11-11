import type { PillarKey } from "./types";

/**
 * QUICK-PICK OPTIONS: DRAFT FOR AUTHOR REVIEW.
 *
 * These lists replace typing with tapping. They are written by the build team in the
 * program's plain voice and are NOT quotations from the book or workbook. Each list
 * is shown in the app with a "Draft options" label until the author approves it.
 * To approve a list, change its `status` to "approved". To edit, change the text.
 *
 * Lists marked `basis: "ch10"` follow examples named in Chapter 10's Design Inventory;
 * `basis: "workbook"` follow the workbook's lowest-pillar guidance in paraphrase.
 */
export type OptionList = { status: "draft" | "approved"; basis?: "ch10" | "workbook"; options: string[] };

/** One move this week, per pillar (FORGE Plan and segment goals). */
export const ONE_MOVE: Record<PillarKey, OptionList> = {
  F: { status: "draft", basis: "workbook", options: [
    "Write my destination in one sentence and read it every morning",
    "Test one decision a day against my destination before I say yes",
    "Set one rule in advance for what does not get my attention this week",
    "Say no to one good thing that is outside my lane",
  ] },
  O: { status: "draft", basis: "workbook", options: [
    "Name three early signals for my most important work",
    "Check my three signals every Friday and write what I saw",
    "Make one course correction this week based on an early signal",
    "Share my signals with my team so they can read the road too",
  ] },
  R: { status: "draft", basis: "workbook", options: [
    "Write my why in full and read it back after a hard day",
    "Share my why with one person who will challenge it",
    "Rewrite my why around the people it serves",
    "Reread my why at the end of the week and note if it still feels true",
  ] },
  G: { status: "draft", basis: "workbook", options: [
    "Treat one small setback this week as something to learn from",
    "Go back to one piece of feedback I brushed off and act on it",
    "Ask where I am the one who needs to recalculate",
    "Show my team how I handle being wrong, out loud",
  ] },
  E: { status: "draft", basis: "workbook", options: [
    "Name the exact situation that takes the wheel from me",
    "Pause before I respond: one breath, one question",
    "Look at the last three times I reacted and find what they share",
    "Notice whether the people around me are calmer when I am present",
  ] },
};

/** Starter behaviors for a 30-day cycle, per pillar. */
export const CYCLE_FOCUS: Record<PillarKey, OptionList> = {
  F: { status: "draft", basis: "workbook", options: [
    "Checking big decisions against my destination before I commit",
    "Keeping urgent requests from moving my weekly priorities",
    "Saying no to opportunities outside my lane",
  ] },
  O: { status: "draft", basis: "workbook", options: [
    "Reading my early signals every week, before the final numbers come in",
    "Acting on an early signal before the results confirm it",
    "Asking my team what they are seeing before the numbers arrive",
  ] },
  R: { status: "draft", basis: "workbook", options: [
    "Staying with the work when it stops being convenient",
    "Reconnecting with my why at the start of each hard day",
    "Naming it out loud when I am tempted to quietly pull back",
  ] },
  G: { status: "draft", basis: "workbook", options: [
    "Asking what friction is telling me before I push harder",
    "Taking feedback without defending or explaining",
    "Changing my approach when a pattern stalls",
  ] },
  E: { status: "draft", basis: "workbook", options: [
    "Pausing before I answer when a decision gets challenged",
    "Staying calm in conversations that used to set me off",
    "Recovering quickly after I react, and repairing it",
  ] },
};

/** Where the practice showed up today (daily check-in tags). */
export const CHECKIN_TAGS: OptionList = { status: "draft", options: [
  "In a meeting", "One-on-one", "With my team", "With a client or customer", "At home", "On my own",
] };

/** Quick picks for each Blueprint area. */
export const BLUEPRINT_PICKS: Record<string, OptionList> = {
  ROUTINES: { status: "draft", basis: "ch10", options: ["Fifteen minutes before the day starts", "Reading", "Journaling", "Prayer or quiet reflection", "Moving my body", "Reading my FORGE Statement"] },
  WEEKLY: { status: "draft", basis: "ch10", options: ["Plan the week ahead", "Look back: did I do what I said?", "Check my three signals"] },
  ACCOUNTABILITY: { status: "draft", options: ["Share my FORGE Statement with my partner", "Every-other-week check-in call", "Text my partner my one move each Monday"] },
  MENTORING: { status: "draft", basis: "ch10", options: ["Monthly call with my mentor", "Regular session with my coach", "Bring one crossroads decision to my mentor"] },
  MENTEES: { status: "draft", basis: "ch10", options: ["Weekly time with someone I am developing", "Teach one thing I am practicing", "Name the potential I see in someone, out loud"] },
  GROUPS: { status: "draft", basis: "ch10", options: ["Weekly peer group", "Mastermind", "A class or cohort", "Community of practice"] },
  RELATIONSHIPS: { status: "draft", options: ["Reach out to one person in my circle each week", "Coffee conversation, nothing to ask for", "Thank-you note to someone who helped me"] },
  LEARNING: { status: "draft", basis: "ch10", options: ["A book I am working through right now", "A course or certification", "A podcast worth becoming like", "Audit my feed"] },
  LEADERSHIP: { status: "draft", options: ["Every commitment gets an owner, a date, and a follow-up", "Follow up on what my team said they would do", "Delegate one task I am still doing myself"] },
  REVIEW: { status: "draft", options: ["Quarterly destination check", "Monthly look at my Blueprint", "Re-take the FORGE assessment every 90 days"] },
};

/** Purpose quick picks per relationship role. */
export const RELATIONSHIP_PURPOSE: Record<string, OptionList> = {
  MENTOR: { status: "draft", basis: "ch10", options: ["Perspective from further up the road", "Tells me the truth at a crossroads"] },
  COACH: { status: "draft", basis: "ch10", options: ["Watches my blind spots", "Checks that I do what I said I would do"] },
  ACCOUNTABILITY_PARTNER: { status: "draft", options: ["Checks on my FORGE Statement", "Checks on my one move each week", "Won't let me manage around my blind spots"] },
  MENTEE: { status: "draft", basis: "ch10", options: ["Someone I am pouring into", "Developing them for a bigger role"] },
  GROUP: { status: "draft", basis: "ch10", options: ["Peers pointed toward growth", "Study and accountability"] },
  DIRECT_REPORT: { status: "draft", options: ["Developing them into a leader", "Weekly one-on-one", "Clear expectations and follow-up"] },
};

/** Check-in frequency choices (days). Shared, not curriculum. */
export const CADENCES = [
  { days: 7, label: "Every week" },
  { days: 14, label: "Every 2 weeks" },
  { days: 30, label: "Every month" },
  { days: 90, label: "Every quarter" },
];
