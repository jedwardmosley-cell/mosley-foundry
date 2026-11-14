import type { PathwayKey } from "./program";
import type { IdentityLevel } from "./identity";

/**
 * WHO I AM: one activity. The role, the kind of change, five sides of one identity (F, O, R, G, E),
 * and one statement. Wording here is build-team draft: DRAFT FOR AUTHOR REVIEW.
 */
export const WHO_I_AM_STATUS: "draft" | "approved" = "draft";

/** The page's name, from the book. The menu, the journey bar and Today all use it. */
export const WHO_TITLE = "Who's behind the wheel";
export const WHO_INTRO = "This is the FORGE framework, applied to you. Name the seat you're in and how big a turn this is, then work through the five parts of one driver. Together they become one statement, and everything after this page is built on it.";
export const WHO_HEADINGS = { role: "Which seat are you in?", kind: "How big a turn is this?", forge: "The five parts of one driver", statement: "My statement" };

/** The FORGE opening above the five letters. The first line is the author's; the rest is build-team draft. */
export const FORGE_OPENING = {
  line: "You only ever rise to the level of who you believe you are.",
  text: "Identity isn't a goal you check off. It's what your mind runs underneath every decision. FORGE breaks it into five parts: where you're going, what it looks like as you get closer, why you're going, the gap between where you are and where you'll be, and the emotional state it takes to be that person when you get there. Research on identity-based motivation, led by psychologist Daphna Oyserman, finds that people stick with actions that feel like \"me\" and drop the ones that don't. Get these five clear and everything you build after this has something real to stand on.",
};

/** "This is about me as a ___." Ordered so the likeliest role for the pathway comes first. */
export const ROLE_PICKS: Record<PathwayKey, string[]> = {
  PERSONAL: ["parent", "project lead", "manager", "coach", "pastor", "owner"],
  LEADING_OTHERS: ["manager", "project lead", "coach", "pastor", "parent", "owner"],
  ENTREPRENEURIAL: ["owner", "manager", "coach", "project lead", "pastor", "parent"],
};

/** The three kinds of change, as equal choices. Names and one-liners from the author's brief. */
export const KIND_NOTE = "None ranks above another. You choose, and you can change it later.";

/** Adds "a" or "an" unless the role already starts with one, or with my, the or our. */
export function withArticle(role: string) {
  const r = role.trim();
  if (!r) return "";
  if (/^(a|an|the|my|our)\s/i.test(r)) return r;
  return `${/^[aeiou]/i.test(r) ? "an" : "a"} ${r}`;
}

/** "Who am I becoming?" becomes "As a manager, who am I becoming?" */
export function asRole(question: string, role: string) {
  const r = withArticle(role);
  return r ? `As ${r}, ${question[0].toLowerCase()}${question.slice(1)}` : question;
}

/**
 * How the AI coaches for each kind of change (the author's brief).
 * The AI never tells a client they chose the wrong kind. If what they write sounds like another kind,
 * it may ask one question. The client decides.
 */
export const KIND_GUIDANCE: Record<IdentityLevel, string> = {
  CORE: "Core alignment: the person already is this. Help them name what is true and where their actions have drifted from it. Do not push for a new identity.",
  ROLE: "Role transition: the person is stepping into something new while the old role still pulls. Help them name what they are leaving, what made them good before that will not carry over, and who they are now.",
  REINVENT: "Identity reinvention: the person is becoming someone substantially different. Go slower. Ask more before offering a statement. Expect it to feel untrue at first, and never push a claim they do not believe. Suggest smaller first moves and bringing it to their coach.",
};
export const KIND_RULE = "Never tell the person they chose the wrong kind of change. If what they write sounds like a different kind, you may ask one question about it. The person decides.";
