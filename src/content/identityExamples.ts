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
  /** The role, as in "This is about me as a ___". */
  role: string;
  level: IdentityLevel;
  claim: string;
  lines: Record<LineField, string>;
};

export const EXAMPLE_PEOPLE: ExamplePerson[] = [
  // Each person's five lines use that role's own word, and each line fits its letter as
  // Chapter 9 defines it (forge-source.md): F where you're going, O what it looks like as you
  // get closer, R why you're going (a reason with somebody else's name on it), G the gap and
  // recalculating without ego, E the emotional state it takes. DRAFT FOR AUTHOR REVIEW.
  {
    key: "owner",
    role: "owner",
    who: "Owner",
    level: "REINVENT",
    claim: "I am the owner of this business. My job is to lead it.",
    lines: {
      destination: "I am an owner building a business that can run without me in the room.",
      lineO: "I am an owner who reads the early signs in my business straight, even when they're bad news.",
      why: "I am an owner building something my family and my employees can count on.",
      lineG: "I am an owner who can admit what I don't know and go learn it.",
      lineE: "I am an owner who stays calm when money is tight. Fear can ride along, but I keep the wheel.",
    },
  },
  {
    key: "manager",
    role: "manager",
    who: "Newly promoted manager",
    level: "ROLE",
    claim: "I am a manager now. My results come through other people.",
    lines: {
      destination: "I am a manager measured by what my team can do.",
      lineO: "I am a manager who notices what my team almost says.",
      why: "I am the manager who makes hard days easier for my team.",
      lineG: "I am a manager who can be corrected without getting defensive.",
      lineE: "I am the same manager on hard days. My team never has to guess who shows up.",
    },
  },
  {
    key: "project",
    role: "project lead",
    who: "Project lead, tough assignment",
    level: "CORE",
    claim: "I am the right project lead for this, and I belong in the seat.",
    lines: {
      destination: "I am a project lead who brings order to hard things.",
      lineO: "I am a project lead who wants the truth about where the project stands, even when it's uncomfortable.",
      why: "I am the project lead who gets my team to the finish without burning them out.",
      lineG: "I am a project lead who changes the plan when the road changes, without taking it personally.",
      lineE: "I am a project lead who stays calm on deadline. Pressure tells me what matters. It doesn't get to tell me who I am.",
    },
  },
  {
    key: "pastor",
    role: "pastor",
    who: "Pastor stepping into the lead role",
    level: "ROLE",
    claim: "I am called to lead this church as its pastor, and preaching is one part of that.",
    lines: {
      destination: "I am a pastor to the whole house, including the parts I didn't build.",
      lineO: "I am a pastor who watches the health of the people more than the size of the room.",
      why: "I am a pastor who leads for the people God put in my care.",
      lineG: "I am a pastor who can hear correction and keep leading.",
      lineE: "I am a pastor who is secure in my calling when I'm criticized.",
    },
  },
  {
    key: "parent",
    who: "Parent",
    role: "parent",
    level: "CORE",
    claim: "I am the parent my kids can count on.",
    lines: {
      destination: "I am a parent raising kids who can stand on their own.",
      lineO: "I am a parent who notices the small signs of how my kids are really doing.",
      why: "I am a parent who makes home the safe place for my kids.",
      lineG: "I am a parent who can say I got it wrong and start again.",
      lineE: "I am the calm parent in my house when the day falls apart.",
    },
  },
  {
    key: "coach",
    who: "New coach",
    role: "coach",
    level: "ROLE",
    claim: "I am a coach now. My work is growing the person in front of me.",
    lines: {
      destination: "I am a coach measured by what my clients can do without me.",
      lineO: "I am a coach who listens for what sits under the question.",
      why: "I am a coach who believes in people before they believe in themselves.",
      lineG: "I am a coach who keeps learning the craft and changes course when a client shows me something new.",
      lineE: "I am a coach who stays settled when a client pushes back.",
    },
  },
];

/** The person shown first for each pathway: the one most like the client. */
const ORDER: Record<PathwayKey, string[]> = {
  PERSONAL: ["project", "parent", "manager", "coach", "pastor", "owner"],
  LEADING_OTHERS: ["manager", "pastor", "coach", "project", "parent", "owner"],
  ENTREPRENEURIAL: ["owner", "project", "manager", "coach", "pastor", "parent"],
};

/**
 * People in the order most like the client: the same role first, then the same kind of change,
 * then the pathway order. Where nothing matches exactly, the closest person still shows, labeled.
 */
export function peopleFor(pathway: PathwayKey, role = "", level = ""): ExamplePerson[] {
  const r = role.trim().toLowerCase();
  const score = (p: ExamplePerson) => (r && p.role === r ? 2 : 0) + (level && p.level === level ? 1 : 0);
  return ORDER[pathway].map((k) => EXAMPLE_PEOPLE.find((p) => p.key === k)!).sort((a, b) => score(b) - score(a));
}

/** Drops the leading "I am" so an example can fill a box that already shows it. */
export const afterIAm = (s: string) => s.replace(/^I am\s+/, "");

/** Example groups for one statement (or for the I am claim when field is "claim"). */
const KIND_NAME: Record<string, string> = { CORE: "core alignment", ROLE: "role transition", REINVENT: "identity reinvention" };

export function exampleGroups(field: LineField | "claim", pathway: PathwayKey, role = "", level = "") {
  return peopleFor(pathway, role, level).map((p) => ({ label: `${p.who} · ${KIND_NAME[p.level]}`, options: [afterIAm(field === "claim" ? p.claim : p.lines[field])] }));
}

/** Placeholder text for a box: the closest person's statement. */
export function examplePlaceholder(field: LineField | "claim", pathway: PathwayKey, role = "", level = "") {
  const p = peopleFor(pathway, role, level)[0];
  return afterIAm(field === "claim" ? p.claim : p.lines[field]);
}
