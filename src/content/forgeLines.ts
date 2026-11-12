import type { PathwayKey } from "./program";
import type { PillarKey } from "./types";

/**
 * FORGE IDENTITY: five identity statements, one per pillar.
 *
 * The questions and the example statements (used as placeholders) are the author's.
 * FORGE describes who is behind the wheel. Habits, tasks and techniques belong downstream,
 * in Discipline by Design (see PRACTICE_STARTERS below).
 *
 * The hints and the tap-to-fill starters were written by the build team: DRAFT FOR AUTHOR REVIEW.
 * They are illustrations, not statements to prescribe. To approve, change FORGE_LINES_STATUS to "approved".
 *
 * F and R are stored in the old Destination and Why fields, so earlier answers carry over.
 */
export const FORGE_LINES_STATUS: "draft" | "approved" = "draft";

export type LineField = "destination" | "lineO" | "why" | "lineG" | "lineE";

export type ForgeLine = {
  pillar: PillarKey;
  field: LineField;
  label: string;
  question: string;
  /** Fixed words the statement starts with. The client finishes the sentence. */
  prefix: string;
  hint: string;
  placeholder: string;
  starters: Record<PathwayKey, string[]>;
};

export const FORGE_LINES: ForgeLine[] = [
  {
    pillar: "F",
    field: "destination",
    label: "Future Focused",
    question: "Who am I becoming?",
    prefix: "I am",
    hint: "Describe the person you are choosing to be and where that person is headed. Plans and tasks go in your Blueprint.",
    placeholder: "a purposeful leader who knows where I am going and takes ownership of my direction",
    starters: {
      PERSONAL: [
        "a purposeful person who knows where I am going and owns my direction",
        "a person who lives my life on purpose",
        "becoming someone who lives by my own priorities instead of other people's urgency",
      ],
      LEADING_OTHERS: [
        "a purposeful leader who knows where we are going and takes ownership of our direction",
        "a leader people can follow because I know what I am building",
        "becoming a leader who builds people as well as results",
      ],
      ENTREPRENEURIAL: [
        "an owner who leads the business toward a clear future",
        "a builder of something that lasts beyond my own effort",
        "becoming a founder who leads the company instead of carrying it",
      ],
    },
  },
  {
    pillar: "O",
    field: "lineO",
    label: "Outcome Aware",
    question: "What does someone with my identity pay attention to?",
    prefix: "I am",
    hint: "Describe the kind of attention this person brings. The signals you will track go in your Blueprint.",
    placeholder: "a discerning leader who recognizes what moves me toward my purpose and what pulls me away",
    starters: {
      PERSONAL: [
        "a discerning person who recognizes what moves me toward my purpose and what pulls me away",
        "an honest observer of my own life, willing to see what is happening",
        "becoming a person who notices the early signs before they turn into problems",
      ],
      LEADING_OTHERS: [
        "a discerning leader who sees what my team needs before they have to ask",
        "a leader who pays attention to people as closely as results",
        "becoming a leader who listens for what is not being said",
      ],
      ENTREPRENEURIAL: [
        "an owner who sees the business clearly, the numbers and the people",
        "a founder who pays attention to what customers are telling me",
        "becoming an owner who notices when I am the bottleneck",
      ],
    },
  },
  {
    pillar: "R",
    field: "why",
    label: "Reason Rooted",
    question: "What makes this identity meaningful to me?",
    prefix: "I am",
    hint: "Name the values underneath this identity, and who it is for.",
    placeholder: "a person whose decisions reflect my deepest values and commitments",
    starters: {
      PERSONAL: [
        "a person whose decisions reflect my deepest values and commitments",
        "a person who lives for something bigger than my own comfort",
        "someone whose word means something to the people I love",
      ],
      LEADING_OTHERS: [
        "a leader who serves because my people deserve my best",
        "a leader whose choices reflect what I believe about people",
        "a leader who cares more about my team's growth than my own recognition",
      ],
      ENTREPRENEURIAL: [
        "an owner who builds because the people who count on this business matter to me",
        "a founder whose business reflects what I value",
        "an owner who measures success by the lives the business makes better",
      ],
    },
  },
  {
    pillar: "G",
    field: "lineG",
    label: "Growth Oriented",
    question: "Who am I when I encounter my limitations?",
    prefix: "I am",
    hint: "Describe who you are when you hit a limit. The skills you will practice go in your Blueprint.",
    placeholder: "a developing leader who embraces challenges as opportunities to become more capable",
    starters: {
      PERSONAL: [
        "a developing person who treats challenges as chances to become more capable",
        "a learner who is honest about where I fall short and keeps growing",
        "a person who can be corrected without being crushed",
      ],
      LEADING_OTHERS: [
        "a developing leader who embraces challenges as opportunities to become more capable",
        "a leader who learns out loud, so my team can too",
        "a leader secure enough to ask for feedback and use it",
      ],
      ENTREPRENEURIAL: [
        "an owner who grows as fast as the business needs me to",
        "a founder who learns from failure without being defined by it",
        "becoming an owner who develops people who can do what I do",
      ],
    },
  },
  {
    pillar: "E",
    field: "lineE",
    label: "Emotionally Anchored",
    question: "Who am I when emotions challenge my identity?",
    prefix: "I am",
    hint: "Describe who you are when emotions run high. Techniques, like a pause or a breath, go in your Blueprint.",
    placeholder: "a courageous, emotionally grounded leader who stays intentional when things get hard",
    starters: {
      PERSONAL: [
        "a courageous, grounded person who stays intentional when things get hard",
        "a person who feels fear fully and still chooses who I am",
        "becoming a person whose emotions inform me without running me",
      ],
      LEADING_OTHERS: [
        "a courageous, emotionally grounded leader who stays intentional when things get hard",
        "a calm presence my team can count on in a hard moment",
        "becoming a leader who chooses my response instead of reacting",
      ],
      ENTREPRENEURIAL: [
        "an owner who stays clear-headed when money or deals get tight",
        "a founder whose confidence comes from who I am more than how the month went",
        "becoming an owner who leads with courage when the stakes are high",
      ],
    },
  },
];

/**
 * Practices that REINFORCE a FORGE identity. These are habits and actions, so they live in
 * Discipline by Design (the Blueprint and the guided session's "My road" step), never in FORGE.
 * Build-team draft, for author review.
 */
export const PRACTICE_STARTERS: Record<PillarKey, Record<PathwayKey, string[]>> = {
  F: {
    PERSONAL: ["Plan my week before it starts", "Read my FORGE identity each morning"],
    LEADING_OTHERS: ["Share where we are headed at the start of each week", "Read my FORGE identity each morning"],
    ENTREPRENEURIAL: ["Spend one hour a week on the business instead of in it", "Read my FORGE identity each morning"],
  },
  O: {
    PERSONAL: ["Look back at the end of each day: what moved me forward?", "Notice when I say yes to things I do not have time for"],
    LEADING_OTHERS: ["Ask about it the same day when someone goes quiet", "Look for the cause when a problem comes back twice"],
    ENTREPRENEURIAL: ["Review my numbers every week", "Fix the system behind any complaint that repeats"],
  },
  R: {
    PERSONAL: ["Keep one promise to myself each day", "Write down why this matters once a week"],
    LEADING_OTHERS: ["Weekly one-on-one with each person on my team", "Tell my team why our work matters"],
    ENTREPRENEURIAL: ["Thank one customer or team member each week", "Check big decisions against what I value"],
  },
  G: {
    PERSONAL: ["Ask for feedback once a week and say thank you", "Learn one new thing each week"],
    LEADING_OTHERS: ["One coaching conversation each week", "Ask a question before I give an answer"],
    ENTREPRENEURIAL: ["Write down one process each week so someone else can run it", "Hand off one task a week"],
  },
  E: {
    PERSONAL: ["Pause and take one breath before I answer when I am frustrated", "Name the fear, then take the next step"],
    LEADING_OTHERS: ["Ask one question before I answer a challenge", "Stay calm when the day goes sideways so my team can too"],
    ENTREPRENEURIAL: ["Take a short walk before a hard call", "Stop and ask who else can when I want to do it all myself"],
  },
};

export const LINE_BY_FIELD = Object.fromEntries(FORGE_LINES.map((l) => [l.field, l])) as Record<LineField, ForgeLine>;

/** Joins a fixed prefix and what the client typed into one sentence. Leaves the text alone if they typed the prefix too. */
export function withPrefix(prefix: string, raw: string) {
  const t = raw.trim();
  if (!t || !prefix) return t;
  if (t.toLowerCase().startsWith(prefix.toLowerCase() + " ")) return t;
  if (prefix === "I am" && /^i'm\s+/i.test(t)) return `I am ${t.replace(/^i'm\s+/i, "")}`;
  const first = /^(A|An|The|Someone|Somebody|Fear|When)\b/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
  return `${prefix} ${first}`;
}

/** The part after the prefix, for editing. Returns null when saved text does not start with the prefix (an older answer). */
export function afterPrefix(prefix: string, saved: string) {
  if (!saved) return "";
  if (!prefix) return saved;
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
  return re.test(saved) ? saved.replace(re, "") : prefix === "I am" && /^i'm\s+/i.test(saved) ? saved.replace(/^i'm\s+/i, "") : null;
}

/** A plain combination of the five lines, for clients who want a starting point without the AI. */
export function combineLines(lines: Partial<Record<LineField, string>>) {
  return FORGE_LINES.map((l) => (lines[l.field] ?? "").trim())
    .filter(Boolean)
    .map((t) => (/[.!?]$/.test(t) ? t : `${t}.`))
    .join(" ");
}
