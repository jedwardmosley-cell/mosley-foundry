/**
 * The three Cs for a power statement worth keeping: it claims, confirms or condemns.
 * The idea is the book's (Center Console). These short descriptions and examples are build-team wording.
 */
export const THREE_CS = {
  CLAIM: { name: "Claim", line: "A victory, a milestone or an outcome I'm going after", example: "I'm leading the team that hits this quarter's number." },
  CONFIRM: { name: "Confirm", line: "A belief about what I'm capable of", example: "I stay calm when a decision gets challenged." },
  CONDEMN: { name: "Condemn", line: "The negativity or the roadblock that would stop me", example: "Old doubts don't get a vote on today." },
} as const;
export type ThreeC = keyof typeof THREE_CS;
export const THREE_C_KEYS = Object.keys(THREE_CS) as ThreeC[];
