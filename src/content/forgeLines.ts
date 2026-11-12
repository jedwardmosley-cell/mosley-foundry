import type { PathwayKey } from "./program";
import type { PillarKey } from "./types";

/**
 * The five FORGE lines: "I am" plus "I do".
 *
 * The questions follow how the book describes each letter:
 *   F the destination, O paying attention to the signs, R why you are going there,
 *   G the distance between here and there, E being emotionally fit to drive.
 * The labels, prefixes, hints and starters were written by the build team: DRAFT FOR AUTHOR REVIEW.
 * To approve, change FORGE_LINES_STATUS to "approved".
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
  /** Fixed words the line starts with. The client finishes the sentence. */
  prefix: string;
  hint: string;
  placeholder: string;
  starters: Record<PathwayKey, string[]>;
};

export const FORGE_LINES: ForgeLine[] = [
  {
    pillar: "F",
    field: "destination",
    label: "Who I am",
    question: "Where am I going? Picture yourself there, as true today.",
    prefix: "I am",
    hint: "This is your destination, claimed in the present tense.",
    placeholder: "a leader who builds a team that runs well without me in every meeting",
    starters: {
      PERSONAL: [
        "a person who does what I say I will do, at work and at home",
        "someone people can count on when plans change",
        "a person who spends my time on what matters most to me",
      ],
      LEADING_OTHERS: [
        "a leader who builds a team that runs well without me in every meeting",
        "a manager my team brings problems to early",
        "a leader who makes hard calls on time and explains them",
      ],
      ENTREPRENEURIAL: [
        "an owner who runs the business instead of doing every job in it",
        "a founder who builds systems other people can run",
        "an owner my people trust to tell them where we are headed",
      ],
    },
  },
  {
    pillar: "O",
    field: "lineO",
    label: "What I notice",
    question: "What signs do I pay attention to?",
    prefix: "I notice",
    hint: "The early signs that tell you whether you are on the road you chose.",
    placeholder: "when someone goes quiet, and I ask about it that day",
    starters: {
      PERSONAL: [
        "when I start saying yes to things I do not have time for",
        "when I put off the hard task, and I do it first the next morning",
        "how I feel at the end of the day, and what drained me",
      ],
      LEADING_OTHERS: [
        "when someone goes quiet, and I ask about it that day",
        "when the same problem comes back twice, and I look for the cause",
        "when I am doing work my team could do",
      ],
      ENTREPRENEURIAL: [
        "when I am the bottleneck, and I hand that decision to someone",
        "the numbers every week, before they surprise me",
        "when a customer complaint repeats, and I fix the system behind it",
      ],
    },
  },
  {
    pillar: "R",
    field: "why",
    label: "Why I go there",
    question: "Why am I going there?",
    prefix: "",
    hint: "Say who it is for. A good reason is still true when the results are slow.",
    placeholder: "I serve my team because they deserve a boss who has their back and tells them the truth.",
    starters: {
      PERSONAL: [
        "I do this because the people I love deserve the best version of me.",
        "I do this because I want my word to mean something.",
        "I do this because I want to look back and know I chose my life on purpose.",
      ],
      LEADING_OTHERS: [
        "I serve my team because they deserve a boss who has their back and tells them the truth.",
        "I lead this way because my people should go home better than they came in.",
        "I do this because my team's growth matters more than my comfort.",
      ],
      ENTREPRENEURIAL: [
        "I build this because my people and their families count on it.",
        "I do this because I want a business that works without burning me out.",
        "I build this because my customers deserve the same quality every time.",
      ],
    },
  },
  {
    pillar: "G",
    field: "lineG",
    label: "What I practice",
    question: "What is the distance between here and there, and how do I close it?",
    prefix: "I practice",
    hint: "One skill you work on now. It says what you do today to close the gap.",
    placeholder: "one coaching conversation each week, so my people grow",
    starters: {
      PERSONAL: [
        "planning my week before it starts, before I open my email",
        "keeping one promise to myself each day, even a small one",
        "asking for feedback once a week and saying thank you",
      ],
      LEADING_OTHERS: [
        "one coaching conversation each week, so my people grow",
        "asking a question before I give an answer",
        "giving clear feedback within a day of seeing something",
      ],
      ENTREPRENEURIAL: [
        "writing down one process each week so someone else can run it",
        "handing off one task a week and not taking it back",
        "reviewing my numbers every week with someone who will ask hard questions",
      ],
    },
  },
  {
    pillar: "E",
    field: "lineE",
    label: "How I respond",
    question: "Am I fit to drive? How do I respond when it gets hard?",
    prefix: "When",
    hint: "Say what shows up and what you do. Courage and confidence take the place of fear.",
    placeholder: "fear shows up, I name it and act anyway",
    starters: {
      PERSONAL: [
        "fear shows up, I name it and take the next step anyway",
        "I get frustrated, I pause and take one breath before I answer",
        "I fall short, I own it and start again the next day",
      ],
      LEADING_OTHERS: [
        "fear shows up, I name it and act anyway",
        "someone challenges my decision, I ask one question before I answer",
        "the day goes sideways, I stay calm so my team can too",
      ],
      ENTREPRENEURIAL: [
        "money gets tight, I look at the numbers and make one clear decision",
        "a deal falls through, I take a short walk and then call the next person",
        "I feel the urge to do it all myself, I stop and ask who else can",
      ],
    },
  },
];

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
