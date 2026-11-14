import type { PathwayKey } from "./program";

/**
 * Identity shift spectrum. Level names, purposes, examples, coaching characteristics and
 * emphasis come from the author's build brief ("brief"). The three levels describe how big
 * a change someone wants to make. None ranks above another.
 */
export type IdentityLevel = "CORE" | "ROLE" | "REINVENT";
export const IDENTITY_LEVELS: IdentityLevel[] = ["CORE", "ROLE", "REINVENT"];

export const LEVELS: Record<IdentityLevel, {
  n: number; name: string; line: string; forWhom: string; examples: string[];
  coaching: string[]; emphasis: string; color: string;
}> = {
  CORE: {
    n: 1,
    name: "Core alignment",
    line: "Strengthen who I am.",
    forWhom: "For people seeking greater consistency between their values, aspirations, and everyday behaviors.",
    examples: ["I want to become someone who consistently follows through."],
    coaching: ["Reflective", "Encouraging", "Grounded", "Small, repeatable behaviors"],
    emphasis: "Clarity, consistency, self-awareness, and personal ownership.",
    color: "rgb(var(--ink-mute))",
  },
  ROLE: {
    n: 2,
    name: "Role transition",
    line: "Grow into a new role.",
    forWhom: "For people transitioning into a new set of responsibilities, expectations, or circumstances.",
    examples: ["Individual contributor to manager", "Peer to supervisor", "Employee to entrepreneur", "New executive responsibilities"],
    coaching: ["Direct", "Practical", "Challenging", "Real-world decisions"],
    emphasis: "New expectations, unfamiliar decisions, capability development, and role-specific behaviors.",
    color: "rgb(var(--ink-soft))",
  },
  REINVENT: {
    n: 3,
    name: "Identity reinvention",
    line: "Become someone new.",
    forWhom: "For people pursuing a significant personal or professional transformation.",
    examples: [
      "A hesitant leader deliberately practicing confident executive presence",
      "An entrepreneur developing a more decisive ownership mindset",
      "A person establishing a disciplined performance identity for demanding situations",
    ],
    coaching: ["Intense", "Performance-oriented", "Highly challenging", "Preparation, rehearsal, action, accountability"],
    emphasis: "Identity cues, personal standards, deliberate practice, and evidence of performance in demanding situations.",
    color: "rgb(var(--heading))",
  },
};

/** How each pathway uses identity development (brief, section 9). */
export const PATHWAY_CONTEXT: Record<PathwayKey, string> = {
  PERSONAL: "On the Personal Leadership pathway, identity work strengthens personal ownership, consistency, and intentional behavior.",
  LEADING_OTHERS: "On the Leading Others pathway, identity work supports management transitions, especially moving from individual contributor or peer to manager.",
  ENTREPRENEURIAL: "On the Entrepreneurial Leadership pathway, identity work supports the move from practitioner to business owner, and from reactive operator to intentional business leader.",
};

/** The example to show first for each level, by pathway. All examples are from the brief. */
export const FIRST_EXAMPLE: Record<PathwayKey, Partial<Record<IdentityLevel, number>>> = {
  PERSONAL: { ROLE: 3, REINVENT: 2 },
  LEADING_OTHERS: { ROLE: 0, REINVENT: 0 },
  ENTREPRENEURIAL: { ROLE: 2, REINVENT: 1 },
};

/**
 * Identity statements are claimed in the present tense: "I am a leader who operates with integrity."
 * Never "I'm becoming..." The statement box starts with a fixed "I am".
 */
export const QUESTIONS = {
  becoming: "Who are you? Claim it.",
  situation: "What situation or chapter of life makes this change important?",
  behavior: "What behavior would demonstrate that you've become this person?",
  level: "How substantial a shift do you want to pursue?",
};

export const PERSONA_FIELDS: { key: "personaName" | "personaQualities" | "personaStandards" | "personaSituations" | "personaCue" | "personaBehaviors"; label: string; long?: boolean }[] = [
  { key: "personaName", label: "Performance identity name" },
  { key: "personaQualities", label: "Defining qualities" },
  { key: "personaStandards", label: "Personal standards", long: true },
  { key: "personaSituations", label: "Situations where this identity is useful" },
  { key: "personaCue", label: "Activation cue or ritual" },
  { key: "personaBehaviors", label: "Behaviors that demonstrate the identity in action", long: true },
];

export const NO_RANK_NOTE = "These three levels describe how big a change you want to make. They say nothing about your worth, your health, or how far along you are. Level 3 does not rank above Level 1 or 2.";
export const PERSONA_NOTE = "A performance identity is a practice tool you choose on purpose. It is a way to prepare for demanding situations. It is still you, and it makes no claim about changing your psychology.";

// ---------- Part 2: how the level shapes FORGE, the blueprint and the daily check-in ----------

/**
 * One prompt per FORGE pillar per level. DRAFT FOR AUTHOR REVIEW.
 * The author's brief gave these for someone working on decisiveness. They are reworded here
 * to fit any behavior. Set the status to "approved" to remove the Draft label.
 */
export const PILLAR_PROMPTS_STATUS: "draft" | "approved" = "draft";
export const PILLAR_PROMPTS: Record<"F" | "O" | "R" | "G" | "E", Record<IdentityLevel, string>> = {
  F: {
    CORE: "Describe what you do on an ordinary day as the person you claimed.",
    ROLE: "List the decisions and responsibilities your new role asks of you.",
    REINVENT: "Write the standards of the performance identity you chose.",
  },
  O: {
    CORE: "Track your everyday behavior and your follow-through.",
    ROLE: "Track the decisions you make in the role and how they turn out.",
    REINVENT: "Review how you performed in your most demanding situations this week.",
  },
  R: {
    CORE: "Connect the behavior to a value you care about.",
    ROLE: "Connect your decisions to what the role is responsible for.",
    REINVENT: "Connect your standards to a mission that matters to you.",
  },
  G: {
    CORE: "Practice the behavior, then reflect on how it went.",
    ROLE: "Rehearse one responsibility that is still unfamiliar.",
    REINVENT: "Use deliberate practice to replace one pattern that is not working.",
  },
  E: {
    CORE: "Notice where you hesitate and what triggers it.",
    ROLE: "Stay effective in situations that are new to you.",
    REINVENT: "Use your activation cue to prepare before a demanding situation.",
  },
};

/**
 * How practice is structured at each level (brief, section 5). The item text is the author's.
 * Each item points at an existing part of the app. The participant still sets every commitment
 * and how often. A higher level never forces more check-ins.
 */
export type PracticeAction =
  | { kind: "commit"; area: string; cadence: "DAILY" | "WEEKLY"; from: "behavior" | "cue" | "standards" | "review"; button: string }
  | { kind: "link"; href: string; button: string };
export const PRACTICE: Record<IdentityLevel, { text: string; action: PracticeAction }[]> = {
  CORE: [
    { text: "One repeatable daily behavior", action: { kind: "commit", area: "ROUTINES", cadence: "DAILY", from: "behavior", button: "Add my behavior as a daily routine" } },
    { text: "Simple weekly reflection", action: { kind: "link", href: "/reflect", button: "Open the weekly reflection" } },
    { text: "Optional accountability relationship", action: { kind: "link", href: "/network?role=ACCOUNTABILITY_PARTNER#add", button: "Add an accountability partner" } },
  ],
  ROLE: [
    { text: "Role-specific behavioral commitments", action: { kind: "commit", area: "LEADERSHIP", cadence: "WEEKLY", from: "behavior", button: "Add my behavior as a role commitment" } },
    { text: "Real-world practice assignments", action: { kind: "link", href: "/cycle/new", button: "Start a 30-day cycle on it" } },
    { text: "Scheduled feedback and accountability check-ins", action: { kind: "link", href: "/network?role=ACCOUNTABILITY_PARTNER#add", button: "Add someone who will give me feedback" } },
  ],
  REINVENT: [
    { text: "Defined performance standards", action: { kind: "commit", area: "ROUTINES", cadence: "DAILY", from: "standards", button: "Add reading my standards as a daily routine" } },
    { text: "Preparation or activation ritual", action: { kind: "commit", area: "ROUTINES", cadence: "DAILY", from: "cue", button: "Add my activation cue as a routine" } },
    { text: "Deliberate practice assignments", action: { kind: "link", href: "/cycle/new", button: "Start a 30-day cycle on it" } },
    { text: "Evidence-based performance review", action: { kind: "commit", area: "REVIEW", cadence: "WEEKLY", from: "review", button: "Add a weekly review against my standards" } },
    { text: "Intentionally chosen accountability relationships", action: { kind: "link", href: "/network?role=ACCOUNTABILITY_PARTNER#add", button: "Choose who checks on me" } },
  ],
};

/** Daily check-in wording (brief, section 7). Always optional. */
export const CHECKIN_IDENTITY = {
  question: "Did you show up as who you are today?",
  followUp: "What did you do that shows it?",
  level3: "Where did you meet your standard today, and where did you fall short?",
  answers: { YES: "Yes", PARTLY: "Partly", NOT_YET: "Not yet" } as const,
};

/**
 * Identity exercises a coach can assign. DRAFT FOR AUTHOR REVIEW. They work at any level, so a
 * coach can suggest identity work without choosing a level for the client.
 */
export const IDENTITY_EXERCISES: { title: string; text: string }[] = [
  { title: "Claim who you are", text: "Open Who's behind the wheel and write your statement as a present-tense claim that starts with I am. Read it out loud. Then choose the level that fits the size of change you want. It is your call, and you can change it later." },
  { title: "The behavior that shows it", text: "Write one behavior another person could see you do if you had already become this person. Then do it once this week and write what happened." },
  { title: "Evidence of the week", text: "Look back at your check-ins this week. Where did you show up as who you said you are? Write two moments, and one where you did not." },
  { title: "Prepare for a demanding situation", text: "Pick one demanding situation coming up. Read your I am statement, then write how you will prepare for it and the first thing you will do when it starts." },
];

// ---------- Quick picks for the identity shift page. DRAFT FOR AUTHOR REVIEW ----------
// Each statement starter finishes the fixed "I am". Lists are ordered to fit the pathway.

export const PICKS_STATUS: "draft" | "approved" = "draft";


export const SITUATION_PICKS: Record<PathwayKey, string[]> = {
  PERSONAL: ["I keep falling short of my own word", "Something big changed in my life", "I want my days to match what I value", "I am starting a new chapter"],
  LEADING_OTHERS: ["I was promoted to lead my former peers", "I am new to managing people", "I took on a bigger team or role", "My team needs more from me than before"],
  ENTREPRENEURIAL: ["I am moving from doing the work to owning the business", "The business has outgrown how I run it", "I am starting something new", "I do everything myself and it shows"],
};

export const BEHAVIOR_PICKS: Record<PathwayKey, string[]> = {
  PERSONAL: ["I finish what I commit to by the date I set", "I tell the truth when it is uncomfortable", "I do my morning routine before I check my phone"],
  LEADING_OTHERS: ["I follow up on every commitment by the date we set", "I make the call in the meeting and say it out loud", "I address problems in the first week"],
  ENTREPRENEURIAL: ["I write down how a task is done the first time I do it", "I say no to work outside my lane", "I hand off one task each week"],
};

export const QUALITY_PICKS = ["Decisive", "Calm", "Direct", "Prepared", "Disciplined", "Present", "Confident", "Generous", "Clear"];
export const PERSONA_SITUATION_PICKS = ["Hard conversations", "Leadership meetings", "Presentations", "Sales calls", "Negotiations", "Conflict", "Big decisions"];
export const CUE_PICKS = [
  "Two slow breaths before I walk in",
  "I read my standards out loud before it starts",
  "I say my performance identity's name to myself",
  "I stand up, roll my shoulders back, and set my feet",
];
export const STANDARD_PICKS = [
  "I decide in the room.",
  "I prepare before every hard conversation.",
  "I do what I said by the time I said.",
  "I speak once, clearly.",
];
