import type { PathwayKey } from "./program";
import type { PillarKey } from "./types";

/**
 * FORGE IDENTITY: five identity statements, one per pillar.
 *
 * The questions are the author's.
 * FORGE describes who is behind the wheel. Habits, tasks and techniques belong downstream,
 * in Discipline by Design (see PRACTICE_STARTERS below).
 *
 * The hints were written by the build team: DRAFT FOR AUTHOR REVIEW. The examples are the author's,
 * in identityExamples.ts. To approve the hints, change FORGE_LINES_STATUS to "approved".
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
};

export const FORGE_LINES: ForgeLine[] = [
  {
    pillar: "F",
    field: "destination",
    label: "Future Focused",
    question: "Who am I becoming?",
    prefix: "I am",
    hint: "Describe the person you are choosing to be and where that person is headed. Plans and tasks go in your blueprint.",
  },
  {
    pillar: "O",
    field: "lineO",
    label: "Outcome Aware",
    question: "What does someone with my identity pay attention to?",
    prefix: "I am",
    hint: "Describe the kind of attention this person brings. The signals you will track go in your blueprint.",
  },
  {
    pillar: "R",
    field: "why",
    label: "Reason Rooted",
    question: "What makes this identity meaningful to me?",
    prefix: "I am",
    hint: "Name the values underneath this identity, and who it is for.",
  },
  {
    pillar: "G",
    field: "lineG",
    label: "Growth Oriented",
    question: "Who am I when I encounter my limitations?",
    prefix: "I am",
    hint: "Describe who you are when you hit a limit. The skills you will practice go in your blueprint.",
  },
  {
    pillar: "E",
    field: "lineE",
    label: "Emotionally Anchored",
    question: "Who am I when emotions challenge my identity?",
    prefix: "I am",
    hint: "Describe who you are when emotions run high. Techniques, like a pause or a breath, go in your blueprint.",
  },
];

/**
 * Practices that REINFORCE a FORGE identity. These are habits and actions, so they live in
 * Discipline by Design (the blueprint and the guided session's "My road" step), never in FORGE.
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
