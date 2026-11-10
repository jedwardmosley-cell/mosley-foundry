export type PillarKey = "F" | "O" | "R" | "G" | "E";
export const PILLAR_KEYS: PillarKey[] = ["F", "O", "R", "G", "E"];

export type Anchor = { score: number; level: string; text: string };

export type Pillar = {
  key: PillarKey;
  name: string;
  short: string;
  definition: string;
  brief: Record<"1" | "3" | "5", string>;
  reflection: string;
  anchors: Anchor[];
  lowest: { min: number; max: number; text: string }[];
  rule?: { heading: string; paragraphs: string[] } | null;
};

export type Chapter = {
  number: number;
  title: string;
  subtitle: string;
  lessons: string[];
  refuel: string[];
  reflect: string[];
  roadTest: string[];
};

export type ContentPack = {
  kind: "licensed" | "public";
  version: number;
  /** "source" = taken from the author's documents. "draft" = placeholder awaiting author review. */
  assessmentStatus: "source" | "draft";
  sources: { id: string; title: string; author: string }[];
  pillars: Pillar[];
  totalBands: { label: string; min: number; max: number; text: string }[];
  patternNote?: string;
  threeNote?: string;
  profiles: {
    name: string;
    subtitle: string;
    scores: Partial<Record<PillarKey, number>>;
    story?: string;
    designedDiscipline?: string;
    lesson?: string;
  }[];
  edsLessons: { chapter: string; title: string; quote?: string; setup?: string; prompts: string[] }[];
  jaysJourney: { title: string; setup?: string; prompts: string[] }[];
  thirtyDayPlan: { label: string; focus: string; work: string }[];
  namePeople: { role: string; prompt: string }[];
  nobodyNote?: string;
  holdYourself?: string;
  forgeStatementPrompt: string;
  actionPlanIntro: string;
  chapters: Chapter[];
  discipline: {
    intro: string[];
    whatDisciplineIs: string[];
    inventory: { label: string; text: string }[];
    whosChecking: string[];
    leadingOthers: string[];
  };
};

export type EntrepreneurPack = {
  source: { id: string; title: string; author: string };
  intro: string[];
  pillars: Record<PillarKey, { tagline: string; brief: Record<"1" | "3" | "5", string>; reflection: string }>;
  patterns: { id: string; title: string; test: { high: PillarKey[]; low: PillarKey[] }; text: string[] }[];
  forgeStatementPrompt: string;
  namePeople: { role: string; prompt: string }[];
  bringToSession: string[];
  owner: {
    source: string;
    fourBuilds: { key: string; label: string; detail: string; signal: string }[];
    howToBuild: string;
    sellableTest: string;
    exercise: string[];
  };
};
