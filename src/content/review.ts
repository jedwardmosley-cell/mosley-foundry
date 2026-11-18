/**
 * CONTENT REVIEW: every set of wording the author has not approved yet, gathered in one place.
 * Clients never see Draft marks. The author sees them here, on the admin Content review page.
 * To approve a set, change its status constant in the file named under "Lives in" to "approved".
 */
import { IDENTITY_EXAMPLES_STATUS, EXAMPLE_PEOPLE, IDENTITY_TESTS } from "./identityExamples";
import { WHO_I_AM_STATUS, ROLE_PICKS, KIND_NOTE, WHO_TITLE, WHO_INTRO, WHO_HEADINGS, FORGE_OPENING } from "./whoIAm";
import { FORGE_LINES_STATUS, FORGE_LINES, PRACTICE_STARTERS } from "./forgeLines";
import { LEVELS, IDENTITY_LEVELS, PICKS_STATUS, SITUATION_PICKS, BEHAVIOR_PICKS, QUALITY_PICKS, PERSONA_SITUATION_PICKS, CUE_PICKS, STANDARD_PICKS } from "./identity";
import { CYCLE_FOCUS, CHECKIN_TAGS, BLUEPRINT_PICKS, RELATIONSHIP_PURPOSE, type OptionList } from "./options";
import { GUIDE_STATUS, CLIENT_GUIDE } from "./guide";
import { SEGMENTS, NIRS_WEEKS, DAY30_DECISIONS, SEASON_DECISIONS } from "./program";
import { todayHeadline } from "@/lib/todayHeadline";
import { FEEDBACK_STATUS, FEEDBACK_SOURCES, FEEDBACK_COPY } from "./feedback";
import { WEEK_ONE_STATUS, SETUP_STEPS, WHO_FINDS_OUT, WEEK_QUESTIONS, AI_FEELING_NOTE, buildPlan, shareMessage, menteeMessage, weekMessage, dayThirtyMessage } from "./weekOne";

export type ReviewGroup = { label: string; items: string[] };
export type ReviewSet = { key: string; title: string; where: string; file: string; draft: boolean; groups: ReviewGroup[] };

const PILLAR_NAME: Record<string, string> = { F: "Future Focused", O: "Outcome Aware", R: "Reason Rooted", G: "Growth Oriented", E: "Emotionally Anchored" };
const PATHWAY_NAME: Record<string, string> = { PERSONAL: "Personal Leadership", LEADING_OTHERS: "Leading Others", ENTREPRENEURIAL: "Entrepreneurial Leadership" };
const lists = (r: Record<string, OptionList>, name: (k: string) => string = (k) => k) =>
  Object.entries(r).map(([k, v]) => ({ label: name(k), items: v.options }));
const anyDraft = (r: Record<string, OptionList>) => Object.values(r).some((v) => v.status === "draft");

export function reviewSets(): ReviewSet[] {
  return [
    {
      key: "who", title: "The Driver's Seat: seats, kinds of change and the FORGE opening", where: "The Driver's Seat, steps 1 to 3", file: "src/content/whoIAm.ts", draft: WHO_I_AM_STATUS === "draft",
      groups: [
        ...Object.entries(ROLE_PICKS).map(([k, v]) => ({ label: `Role picks, ${PATHWAY_NAME[k]}`, items: v })),
        { label: "Kinds of change", items: IDENTITY_LEVELS.map((k) => `${LEVELS[k].name}: ${LEVELS[k].line}`) },
        { label: "Note under the kinds", items: [KIND_NOTE] },
        { label: "Page title and intro", items: [WHO_TITLE, WHO_INTRO] },
        { label: "Headings", items: Object.values(WHO_HEADINGS) },
        { label: "FORGE opening", items: [FORGE_OPENING.line, FORGE_OPENING.text] },
      ],
    },
    {
      key: "lines", title: "The five FORGE questions", where: "The Driver's Seat, the five rules", file: "src/content/forgeLines.ts", draft: FORGE_LINES_STATUS === "draft",
      groups: FORGE_LINES.map((l) => ({ label: `${l.pillar}: ${l.label}`, items: [l.question, `What it is about: ${l.shapes}`, `Hint: ${l.hint}`] })),
    },
    {
      key: "examples", title: "Identity examples", where: "The Driver's Seat, under each question", file: "src/content/identityExamples.ts", draft: IDENTITY_EXAMPLES_STATUS === "draft",
      groups: [
        { label: "The four tests", items: IDENTITY_TESTS },
        ...EXAMPLE_PEOPLE.map((p) => ({ label: `${p.who}, ${LEVELS[p.level].name.toLowerCase()}`, items: [p.claim, ...FORGE_LINES.map((l) => `${l.pillar}: ${p.lines[l.field]}`)] })),
      ],
    },
    {
      key: "picks", title: "Identity quick picks", where: "The Driver's Seat and the Vehicle Controls", file: "src/content/identity.ts", draft: PICKS_STATUS === "draft",
      groups: [
        ...Object.entries(SITUATION_PICKS).map(([k, v]) => ({ label: `Situation, ${PATHWAY_NAME[k]}`, items: v })),
        ...Object.entries(BEHAVIOR_PICKS).map(([k, v]) => ({ label: `Behavior, ${PATHWAY_NAME[k]}`, items: v })),
        { label: "Performance identity: qualities", items: QUALITY_PICKS },
        { label: "Performance identity: situations", items: PERSONA_SITUATION_PICKS },
        { label: "Performance identity: cues", items: CUE_PICKS },
        { label: "Performance identity: standards", items: STANDARD_PICKS },
      ],
    },
    { key: "focus", title: "30-day focus ideas", where: "30 days, start a cycle", file: "src/content/options.ts", draft: anyDraft(CYCLE_FOCUS), groups: lists(CYCLE_FOCUS, (k) => PILLAR_NAME[k]) },
    {
      key: "starters", title: "Practice starters", where: "The Vehicle Controls, routines", file: "src/content/forgeLines.ts", draft: true,
      groups: Object.entries(PRACTICE_STARTERS).flatMap(([k, v]) => Object.entries(v).map(([p, items]) => ({ label: `${PILLAR_NAME[k]}, ${PATHWAY_NAME[p]}`, items }))),
    },
    { key: "blueprint", title: "Vehicle Controls picks", where: "The Vehicle Controls, add to an area", file: "src/content/options.ts", draft: anyDraft(BLUEPRINT_PICKS), groups: lists(BLUEPRINT_PICKS) },
    { key: "people", title: "Relationship purposes", where: "People", file: "src/content/options.ts", draft: anyDraft(RELATIONSHIP_PURPOSE), groups: lists(RELATIONSHIP_PURPOSE) },
    { key: "tags", title: "Check-in tags", where: "The Dashboard, add detail", file: "src/content/options.ts", draft: CHECKIN_TAGS.status === "draft", groups: [{ label: "Where?", items: CHECKIN_TAGS.options }] },
    {
      key: "feedback", title: "My feedback", where: "The Rules of the Road, My feedback", file: "src/content/feedback.ts", draft: FEEDBACK_STATUS === "draft",
      groups: [{ label: "Sources", items: Object.values(FEEDBACK_SOURCES) }, { label: "Wording", items: Object.values(FEEDBACK_COPY) }],
    },
    {
      key: "weekone", title: "30 days: week 1 setup and who finds out", where: "30 days, week 1 setup, the weekly reflection and day 30", file: "src/content/weekOne.ts", draft: WEEK_ONE_STATUS === "draft",
      groups: [
        { label: "The five questions", items: SETUP_STEPS.map((x) => `${x.label}: ${x.question} ${x.hint}`) },
        { label: "Help me with this, on the feeling", items: [AI_FEELING_NOTE] },
        { label: "Who finds out?", items: [WHO_FINDS_OUT.title, WHO_FINDS_OUT.hint, `When My people is empty: ${WHO_FINDS_OUT.empty} ${WHO_FINDS_OUT.emptyHint}`] },
        { label: "Weeks 2 to 4", items: Object.values(WEEK_QUESTIONS).map((w) => `${w.title}: ${w.question}`) },
        { label: "Messages, with an example", items: [
          buildPlan({ situation: "When someone pushes back on my decision in a meeting", feeling: "Heat in my chest", newResponse: "Pause and ask one question before I answer" }),
          shareMessage({ situation: "When someone pushes back on my decision in a meeting", newResponse: "Pause and ask one question before I answer" }),
          menteeMessage("When someone pushes back on my decision, I will pause and ask one question first."),
          weekMessage(2, { real: "YES" }, "Pause and ask one question before I answer"),
          weekMessage(3, { working: "PARTLY", gap: "SMALLER" }, "Pause and ask one question before I answer"),
          weekMessage(4, { keep: "A sticky note on my laptop" }, ""),
          dayThirtyMessage("I am a manager my team trusts with bad news.", 24),
        ] },
      ],
    },
    {
      key: "today", title: "Dashboard headlines", where: "The Dashboard, top card", file: "src/lib/todayHeadline.ts", draft: true,
      groups: [{
        label: "Written by rule, with no counts or praise",
        items: [
          todayHeadline({ cycle: false, finished: false, day: 0 }),
          todayHeadline({ cycle: true, finished: true, day: 30 }),
          todayHeadline({ cycle: true, finished: false, day: 12 }),
        ].map((h) => `${h.label}. ${h.title} ${h.line}`),
      }],
    },
    {
      key: "weeks", title: "30-day week descriptions", where: "30 days", file: "src/content/program.ts", draft: NIRS_WEEKS.some((w) => w.status !== "source"),
      groups: [{ label: "Name It, Interrupt It, Replace It, Sustain It", items: NIRS_WEEKS.map((w) => `Week ${w.week}, ${w.phase}: ${w.work}`) }],
    },
    {
      key: "season", title: "Season and day 30 choices", where: "30 days and Seasons", file: "src/content/program.ts", draft: true,
      groups: [{ label: "Day 30", items: Object.values(DAY30_DECISIONS) }, { label: "Season review", items: Object.values(SEASON_DECISIONS) }],
    },
    {
      key: "segments", title: "Leading Others segment practices", where: "Pathway segments", file: "src/content/program.ts", draft: SEGMENTS.some((s) => s.practice.status === "draft"),
      groups: SEGMENTS.map((s) => ({ label: `Segment ${s.key}: ${s.title}`, items: [s.practice.text] })),
    },
    {
      key: "guide", title: "Client guide", where: "Guide", file: "src/content/guide.ts", draft: GUIDE_STATUS === "draft",
      groups: CLIENT_GUIDE.map((g) => ({ label: g.title, items: [g.intro ?? "", ...g.steps, g.note ?? ""].filter(Boolean) })),
    },
  ];
}
