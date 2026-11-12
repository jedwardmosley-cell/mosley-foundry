import type { PathwayKey } from "./program";
import type { IdentityLevel } from "./identity";
import type { LineField } from "./forgeLines";

/**
 * IDENTITY EXAMPLES: the author's drafts, kept as written. DRAFT FOR AUTHOR REVIEW.
 * To approve, change IDENTITY_EXAMPLES_STATUS to "approved".
 *
 * Four people, so users can see themselves. Each set has the I am claim and one statement per
 * FORGE letter. Every example must pass the four tests below. Behavior has its own home in
 * My road (one move this week) and 30 days (the practice).
 *
 * Banned words and the "X, not Y" pattern are checked by tests/style.test.ts.
 */
export const IDENTITY_EXAMPLES_STATUS: "draft" | "approved" = "draft";

/** The author's four tests for an identity statement. */
export const IDENTITY_TESTS = [
  "Could it go on a to-do list? Then it's a behavior. Rewrite it.",
  "Could you finish it? Then it's a goal.",
  "Does it produce many behaviors, or only one? Identity produces many.",
  "Is it specific because of the shift you are making, and not because of an action?",
];

/** The author's definitions, used on screen and by the identity coach. */
export const FOUR_THINGS = {
  goal: "something you reach and finish",
  habit: "something you do on a schedule",
  value: "something you believe in",
  identity: "who you are. It can't be completed, only lived or abandoned",
};

export type ExamplePerson = {
  key: string;
  who: string;
  level: IdentityLevel;
  claim: string;
  lines: Record<LineField, string>;
};

export const EXAMPLE_PEOPLE: ExamplePerson[] = [
  {
    key: "owner",
    who: "Owner",
    level: "REINVENT",
    claim: "I am the owner of this business. My job is to lead it.",
    lines: {
      destination: "I am a builder of something that can run without me in the room.",
      lineO: "I am an owner who sees the whole business.",
      why: "I am a provider building something that outlasts a paycheck.",
      lineG: "I am in charge without being the expert on everything.",
      lineE: "I am calm when money is tight. Fear can ride along, but I keep the wheel.",
    },
  },
  {
    key: "manager",
    who: "Newly promoted manager",
    level: "ROLE",
    claim: "I am a leader now. My results come through other people.",
    lines: {
      destination: "I am a leader measured by what my team can do.",
      lineO: "I am a leader who puts people before tasks.",
      why: "I am the boss I needed when I was coming up.",
      lineG: "I am new at this and not ashamed of it. I can lead while I learn.",
      lineE: "I am the same person on hard days. My team never has to guess who shows up.",
    },
  },
  {
    key: "project",
    who: "Project manager, tough assignment",
    level: "CORE",
    claim: "I am the right person for this, and I belong in the seat.",
    lines: {
      destination: "I am a leader who brings order to hard things.",
      lineO: "I am someone who wants the truth about the project, even when it's uncomfortable.",
      why: "I am the one people trust with the hard thing.",
      lineG: "I am not the smartest person here and don't need to be. I get smart people pulling the same way.",
      lineE: "I am calm under a deadline. Pressure tells me what matters. It doesn't get to tell me who I am.",
    },
  },
  {
    key: "pastor",
    who: "Pastor stepping into the lead role",
    level: "ROLE",
    claim: "I am called to lead this church, and preaching is one part of that.",
    lines: {
      destination: "I am a shepherd of the whole house, including the parts I didn't build.",
      lineO: "I am a pastor who watches the health of the people more than the size of the room.",
      why: "I am here because I was called.",
      lineG: "I am a leader who depends on God and the people He put around me.",
      lineE: "I am secure in my calling when I'm criticized.",
    },
  },
];

/** The person shown first for each pathway: the one most like the client. */
const ORDER: Record<PathwayKey, string[]> = {
  PERSONAL: ["project", "manager", "pastor", "owner"],
  LEADING_OTHERS: ["manager", "pastor", "project", "owner"],
  ENTREPRENEURIAL: ["owner", "project", "manager", "pastor"],
};

export function peopleFor(pathway: PathwayKey): ExamplePerson[] {
  return ORDER[pathway].map((k) => EXAMPLE_PEOPLE.find((p) => p.key === k)!);
}

/** Drops the leading "I am" so an example can fill a box that already shows it. */
export const afterIAm = (s: string) => s.replace(/^I am\s+/, "");

/** Example groups for one statement (or for the I am claim when field is "claim"). */
export function exampleGroups(field: LineField | "claim", pathway: PathwayKey) {
  return peopleFor(pathway).map((p) => ({ label: p.who, options: [afterIAm(field === "claim" ? p.claim : p.lines[field])] }));
}

/** Placeholder text for a box: the closest person's statement. */
export function examplePlaceholder(field: LineField | "claim", pathway: PathwayKey) {
  const p = peopleFor(pathway)[0];
  return afterIAm(field === "claim" ? p.claim : p.lines[field]);
}
