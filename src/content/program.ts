import type { PillarKey } from "./types";

/**
 * Program structure. Everything here comes from the build brief written by the
 * author, except where `status: "draft"` marks text that needs author review.
 * Book and workbook text lives in the licensed content pack, not here.
 */

export type ContentStatus = "source" | "brief" | "draft";

export const PATHWAYS = {
  PERSONAL: {
    key: "PERSONAL",
    name: "Personal Leadership",
    line: "For individuals seeking greater intentionality, personal growth, accountability, and self-leadership.",
    instrument: "FORGE_PERSONAL",
    cycleTemplate: "WORKBOOK_30",
  },
  LEADING_OTHERS: {
    key: "LEADING_OTHERS",
    name: "Leading Others",
    line: "For managers, supervisors, emerging leaders, and executives.",
    instrument: "FORGE_PERSONAL",
    cycleTemplate: "NIRS_30",
  },
  ENTREPRENEURIAL: {
    key: "ENTREPRENEURIAL",
    name: "Entrepreneurial Leadership",
    line: "For founders and small-business owners moving from doing everything themselves to building repeatable systems and developing others.",
    instrument: "FORGE_ENTREPRENEUR",
    cycleTemplate: "NIRS_30",
  },
} as const;
export type PathwayKey = keyof typeof PATHWAYS;

/** The ten Blueprint areas from the brief, each tied to the Design Inventory label in Ch. 10 where one exists. */
export const BLUEPRINT_AREAS = [
  { key: "ROUTINES", label: "Personal commitments and routines", inventory: "Daily", hint: "What happens before the world starts making demands?" },
  { key: "WEEKLY", label: "Weekly planning and reflection", inventory: "Weekly", hint: "One appointment to decide what matters, one to look back." },
  { key: "ACCOUNTABILITY", label: "Named accountability partners", inventory: null, hint: "When you don't do what you said, who finds out?" },
  { key: "MENTORING", label: "Mentors and coaching relationships", inventory: "Your mentor", hint: "Someone further up the road, and someone on the road with you now." },
  { key: "MENTEES", label: "Mentees and people I develop", inventory: "Your mentee", hint: "Somebody coming up behind you that you're pouring into." },
  { key: "GROUPS", label: "Growth-oriented groups and communities", inventory: "Your groups", hint: "People pointed toward growth instead of just relief." },
  { key: "RELATIONSHIPS", label: "Relationship maintenance and check-ins", inventory: null, hint: "Those relationships don't keep themselves together." },
  { key: "LEARNING", label: "Learning and development commitments", inventory: "Your classes", hint: "Keep something in the pipeline." },
  { key: "LEADERSHIP", label: "Leadership responsibilities and delegated commitments", inventory: null, hint: "What did we say we'd do. Who's doing it. When are we coming back to look at it." },
  { key: "REVIEW", label: "Regular evaluation and adjustment", inventory: null, hint: "Is the design still building what you want?" },
] as const;
export type BlueprintArea = (typeof BLUEPRINT_AREAS)[number]["key"];

/** Inventory items in Ch. 10 that are not one of the ten areas above; offered as optional routines. */
export const EXTRA_INVENTORY = ["Your coach", "Your feed", "Your engine"];

export const RELATIONSHIP_ROLES = {
  MENTOR: "Mentor",
  COACH: "Coach",
  ACCOUNTABILITY_PARTNER: "Accountability partner",
  MENTEE: "Mentee",
  GROUP: "Group",
  DIRECT_REPORT: "Direct report",
} as const;
export type RelationshipRole = keyof typeof RELATIONSHIP_ROLES;

/** The six-segment manager program, as described in the brief. */
export const SEGMENTS: {
  key: string;
  title: string;
  summary: string;
  pillars: PillarKey[];
  practice: { status: ContentStatus; text: string };
  commitmentArea: BlueprintArea;
}[] = [
  {
    key: "01",
    title: "Leading Others",
    summary: "Move from doing the work to multiplying it. Set expectations, delegate with confidence, and maintain relationships with former peers.",
    pillars: ["F", "R"],
    practice: { status: "draft", text: "Name one task you are still doing that someone on your team should own. Write the expectation you would hand over with it, and the date you will check back." },
    commitmentArea: "LEADERSHIP",
  },
  {
    key: "02",
    title: "Knowing Yourself as a Leader",
    summary: "Use EQ-i 2.0 assessment insights to understand emotional reactions, behavior under pressure, and the impact on others.",
    pillars: ["E", "G"],
    practice: { status: "draft", text: "Pick one development priority from your debrief. Name the situation where it shows up and one small practice you can use in that moment." },
    commitmentArea: "ROUTINES",
  },
  {
    key: "03",
    title: "Hard Conversations",
    summary: "Address issues early. Distinguish coaching conversations, documentation, and escalation.",
    pillars: ["E", "O"],
    practice: { status: "draft", text: "Name the conversation you have been going around. Decide whether it is a coaching conversation, documentation, or escalation, and put a date on it." },
    commitmentArea: "LEADERSHIP",
  },
  {
    key: "04",
    title: "Driving Accountability",
    summary: "Translate commitments into named owners, deadlines, clear expectations, and sustainable follow-through.",
    pillars: ["O", "F"],
    practice: { status: "draft", text: "Take one open team commitment. Write what we said we'd do, who's doing it, and when we are coming back to look at it. Share all three where both of you can see them." },
    commitmentArea: "LEADERSHIP",
  },
  {
    key: "05",
    title: "Leading Through Change",
    summary: "Lead amid uncertainty, clarify decision rights, and move people from compliance toward genuine commitment.",
    pillars: ["R", "G"],
    practice: { status: "draft", text: "For one change your team is living through, write who decides what. Then write the reason it matters in words your team would use." },
    commitmentArea: "LEADERSHIP",
  },
  {
    key: "06",
    title: "Practical AI for Leaders",
    summary: "Apply AI to real managerial responsibilities, including communication, scheduling, reports, and meeting notes, while exercising judgment and helping teams adopt new tools.",
    pillars: ["G", "O"],
    practice: { status: "draft", text: "Choose one recurring task (a status report, meeting notes, a team update). Try it with an AI tool this week, check the output yourself, and note what you would and would not trust it with." },
    commitmentArea: "LEARNING",
  },
];

/** Delivery formats: two half-day segments per day, or per week. Admins set real dates. */
export const DELIVERY_FORMATS = {
  THREE_DAY: { label: "Three consecutive days, two half-day segments per day", stepDays: 1 },
  THREE_WEEK: { label: "Three weeks, two half-day segments per week", stepDays: 7 },
} as const;

/** Default schedule: segment n on day/week floor(n/2), morning or afternoon. Admin can edit every slot. */
export function defaultSchedule(start: Date, format: keyof typeof DELIVERY_FORMATS) {
  const step = DELIVERY_FORMATS[format].stepDays;
  return SEGMENTS.map((s, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + Math.floor(i / 2) * step);
    d.setHours(i % 2 === 0 ? 9 : 13, 0, 0, 0);
    return { segmentKey: s.key, startsAt: d };
  });
}

export type CycleWeek = { week: number; phase: string; work: string; status: ContentStatus };

/**
 * 30-day cycle templates.
 * WORKBOOK_30: Personal Application Workbook, Section Seven (loaded from the licensed pack).
 * NIRS_30: Name It / Interrupt It / Replace It / Sustain It, phase descriptions from the brief.
 *          The FORGE Application Workbook's daily assignments were not available, so the
 *          weekly work below is the brief's description and is marked "brief".
 */
export const NIRS_WEEKS: CycleWeek[] = [
  { week: 1, phase: "Name It", work: "Recognize patterns, triggers, behaviors, and consequences.", status: "brief" },
  { week: 2, phase: "Interrupt It", work: "Identify moments when habitual responses can be interrupted.", status: "brief" },
  { week: 3, phase: "Replace It", work: "Practice new behaviors and seek feedback.", status: "brief" },
  { week: 4, phase: "Sustain It", work: "Establish routines, relationships, and structures that reinforce the desired behavior.", status: "brief" },
];

export const CHECKIN_STATUS = {
  DONE: "Done",
  PARTIAL: "Partial",
  NOT_YET: "Not yet",
} as const;
export type CheckInStatus = keyof typeof CHECKIN_STATUS;

export const DAY30_DECISIONS = {
  CONTINUE_ALONE: "Keep doing this work on my own",
  GO_FURTHER: "Go further, with coaching or a group",
  NEW_CYCLE: "Start a new cycle on another pillar",
  // Inside a 90-day season (build-team wording, draft)
  NEXT_SAME: "Next month: go deeper on the same pillar",
  NEXT_OTHER: "Next month: work on another pillar",
  END_SEASON: "End the season here and review it",
  SEASON_REVIEW: "Finish the season and review it",
} as const;
export type Day30Decision = keyof typeof DAY30_DECISIONS;
/** The day 30 choices shown outside a season, in months 1 and 2 of a season, and in month 3. */
export const DAY30_CHOICES = {
  none: ["CONTINUE_ALONE", "GO_FURTHER", "NEW_CYCLE"],
  midSeason: ["NEXT_SAME", "NEXT_OTHER", "END_SEASON"],
  lastMonth: ["SEASON_REVIEW"],
} as const satisfies Record<string, readonly Day30Decision[]>;

/** Seasons: three 30-day cycles, about 90 days. Build-team wording, DRAFT FOR AUTHOR REVIEW. */
export const SEASON_LENGTH = 3;
export const SEASON_DECISIONS = {
  NEW_SEASON: "Start a new season",
  KEEP_GOING: "Keep going on my own, one month at a time",
  PAUSE: "Take a break and come back later",
} as const;
