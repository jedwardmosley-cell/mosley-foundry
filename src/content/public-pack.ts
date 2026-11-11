import type { ContentPack } from "./types";

/**
 * PUBLIC FALLBACK PACK (committed to the repository).
 *
 * Used only when the licensed pack (src/content/licensed/pack.json, gitignored)
 * is not installed. It contains the FORGE names and one-line rules as given in
 * the build brief, plus a DRAFT assessment that is clearly labeled as such.
 * It does not reproduce the manuscript or workbook.
 */
const draftAnchors = (low: string, mid: string, high: string) => [
  { score: 1, level: "Not Yet (draft)", text: low },
  { score: 2, level: "Developing (draft)", text: "Between 1 and 3." },
  { score: 3, level: "Operating (draft)", text: mid },
  { score: 4, level: "Integrated (draft)", text: "Between 3 and 5." },
  { score: 5, level: "Leading (draft)", text: high },
];

export const publicPack: ContentPack = {
  kind: "public",
  version: 1,
  assessmentStatus: "draft",
  sources: [{ id: "brief", title: "Build brief (FORGE definitions only)", author: "Jason Mosley" }],
  pillars: [
    {
      key: "F", name: "Future Focused", short: "Know your destination.",
      definition: "Know your destination.",
      brief: { "1": "No clear destination guides daily choices.", "3": "A destination exists but urgency crowds it out.", "5": "Decisions are filtered through the destination." },
      reflection: "Where are you going?",
      anchors: draftAnchors("No clear destination guides daily choices.", "A destination exists but urgency crowds it out.", "Decisions are filtered through the destination."),
      lowest: [{ min: 1, max: 5, text: "Draft guidance. Install the licensed content pack for the author's guidance." }],
    },
    {
      key: "O", name: "Outcome Aware", short: "Watch the signs.",
      definition: "Watch the signs and evidence of progress.",
      brief: { "1": "Progress is judged only by final results.", "3": "Some early signals are noticed but not used.", "5": "Early signals are read and acted on." },
      reflection: "What evidence tells you that you are on the right road?",
      anchors: draftAnchors("Progress is judged only by final results.", "Some early signals are noticed but not used.", "Early signals are read and acted on."),
      lowest: [{ min: 1, max: 5, text: "Draft guidance. Install the licensed content pack for the author's guidance." }],
    },
    {
      key: "R", name: "Reason Rooted", short: "Know why the trip matters.",
      definition: "Understand why the journey matters.",
      brief: { "1": "Commitment fades when the work gets hard.", "3": "The reason lasts when things are easy.", "5": "The reason lasts when the road is hard." },
      reflection: "Why does this journey matter?",
      anchors: draftAnchors("Commitment fades when the work gets hard.", "The reason lasts when things are easy.", "The reason lasts when the road is hard."),
      lowest: [{ min: 1, max: 5, text: "Draft guidance. Install the licensed content pack for the author's guidance." }],
    },
    {
      key: "G", name: "Growth Oriented", short: "Recalculate without ego.",
      definition: "Learn, adapt, and recalculate without ego.",
      brief: { "1": "Friction is defended against.", "3": "Friction is acknowledged but old patterns return.", "5": "Friction is used as information." },
      reflection: "Where do you need to recalculate?",
      anchors: draftAnchors("Friction is defended against.", "Friction is acknowledged but old patterns return.", "Friction is used as information."),
      lowest: [{ min: 1, max: 5, text: "Draft guidance. Install the licensed content pack for the author's guidance." }],
    },
    {
      key: "E", name: "Emotionally Anchored", short: "Be fit to drive.",
      definition: "Develop the emotional awareness and regulation necessary to lead effectively under pressure.",
      brief: { "1": "Reactions drive decisions.", "3": "Usually calm, with triggers you can predict.", "5": "Calm in hard moments, and calming for others." },
      reflection: "What reliably takes the wheel from you?",
      anchors: draftAnchors("Reactions drive decisions.", "Usually calm, with triggers you can predict.", "Calm in hard moments, and calming for others."),
      lowest: [{ min: 1, max: 5, text: "Draft guidance. Install the licensed content pack for the author's guidance." }],
    },
  ],
  totalBands: [
    { label: "20 to 25", min: 20, max: 25, text: "Draft interpretation pending author content." },
    { label: "14 to 19", min: 14, max: 19, text: "Draft interpretation pending author content." },
    { label: "Below 14", min: 5, max: 13, text: "Draft interpretation pending author content." },
  ],
  profiles: [],
  edsLessons: [],
  jaysJourney: [],
  thirtyDayPlan: [],
  namePeople: [
    { role: "mentor", prompt: "Someone further up the road" },
    { role: "accountability partner", prompt: "Someone who checks on your commitments" },
    { role: "mentee", prompt: "Someone you are developing" },
  ],
  forgeStatementPrompt: "One paragraph: the leader you are becoming, the destination you are driving toward, and the discipline you are committing to build.",
  actionPlanIntro: "For each pillar, note where you are now, where you want to be, and one move this week.",
  chapters: [],
  discipline: { intro: [], whatDisciplineIs: [], inventory: [], whosChecking: [], leadingOthers: [] },
};
