import type { PathwayKey } from "./program";

/**
 * Identity Shift Spectrum. Level names, purposes, examples, coaching characteristics and
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
    name: "Core Alignment",
    line: "Strengthen who I am.",
    forWhom: "For people seeking greater consistency between their values, aspirations, and everyday behaviors.",
    examples: ["I want to become someone who consistently follows through."],
    coaching: ["Reflective", "Encouraging", "Grounded", "Small, repeatable behaviors"],
    emphasis: "Clarity, consistency, self-awareness, and personal ownership.",
    color: "#5E7A64",
  },
  ROLE: {
    n: 2,
    name: "Role Transition",
    line: "Become effective in a new role.",
    forWhom: "For people transitioning into a new set of responsibilities, expectations, or circumstances.",
    examples: ["Individual contributor to manager", "Peer to supervisor", "Employee to entrepreneur", "New executive responsibilities"],
    coaching: ["Direct", "Practical", "Challenging", "Real-world decisions"],
    emphasis: "New expectations, unfamiliar decisions, capability development, and role-specific behaviors.",
    color: "#A77B3B",
  },
  REINVENT: {
    n: 3,
    name: "Identity Reinvention",
    line: "Deliberately construct a new performance identity.",
    forWhom: "For people pursuing a significant personal or professional transformation.",
    examples: [
      "A hesitant leader deliberately practicing confident executive presence",
      "An entrepreneur developing a more decisive ownership mindset",
      "A person establishing a disciplined performance identity for demanding situations",
    ],
    coaching: ["Intense", "Performance-oriented", "Highly challenging", "Preparation, rehearsal, action, accountability"],
    emphasis: "Identity cues, personal standards, deliberate practice, and evidence of performance in demanding situations.",
    color: "#1E2F4A",
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

export const QUESTIONS = {
  becoming: "Who are you becoming?",
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
