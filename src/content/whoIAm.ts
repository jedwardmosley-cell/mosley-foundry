import type { PathwayKey } from "./program";
import type { IdentityLevel } from "./identity";

/**
 * WHO I AM: one activity. The role, the kind of change, five sides of one identity (F, O, R, G, E),
 * and one statement. Wording here is build-team draft: DRAFT FOR AUTHOR REVIEW.
 */
export const WHO_I_AM_STATUS: "draft" | "approved" = "draft";

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
