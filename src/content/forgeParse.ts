import type { PillarKey } from "./types";

/** Reads forge-source.md into the FORGE teaching cards. No server code, so tests can use it. */
export type ForgeCard = {
  rule: string;
  means: string;
  road: string;
  roadMore: string;
  why: string;
  whyMore: string;
  sources: string;
  connects: string;
  beforeIntro: string;
  before: string[];
  roadTest: string;
};
export type ForgeSource = {
  draft: boolean;
  intro: { line: string; forge: string; parts: string };
  chapter: Partial<Record<PillarKey, { heading: string; paragraphs: string[] }>>;
  cards: Partial<Record<PillarKey, ForgeCard>>;
};

/** Splits markdown into sections by a heading level: { title: body }. */
function sections(md: string, level: number): Record<string, string> {
  const mark = "#".repeat(level) + " ";
  const out: Record<string, string> = {};
  let key = "";
  for (const line of md.split("\n")) {
    if (line.startsWith(mark)) { key = line.slice(mark.length).trim(); out[key] = ""; continue; }
    if (key) out[key] += line + "\n";
  }
  return out;
}
const paras = (s = "") => s.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
const text = (s = "") => paras(s).join("\n\n");

export function parseForgeSource(md: string): ForgeSource {
  const top = sections(md, 1);
  const titleKey = (prefix: string) => Object.keys(top).find((k) => k.startsWith(prefix)) ?? "";
  const intro = sections(top[titleKey("Intro")] ?? "", 2);
  const chapter: ForgeSource["chapter"] = {};
  for (const [k, body] of Object.entries(sections(top[titleKey("Chapter 9")] ?? "", 2))) {
    const h = sections(body, 3);
    const heading = Object.keys(h)[0];
    if (heading && /^[FORGE]$/.test(k)) chapter[k as PillarKey] = { heading, paragraphs: paras(h[heading]) };
  }
  const cards: ForgeSource["cards"] = {};
  for (const [k, body] of Object.entries(sections(top[titleKey("Cards")] ?? "", 2))) {
    if (!/^[FORGE]$/.test(k)) continue;
    const c = sections(body, 3);
    const beforeLines = (c["Before you write"] ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    cards[k as PillarKey] = {
      rule: text(c["Rule"]),
      means: text(c["What it means"]),
      road: text(c["From the road"]),
      roadMore: text(c["From the road, more"]),
      why: text(c["Why it works"]),
      whyMore: text(c["Why it works, more"]),
      sources: text(c["Sources"]),
      connects: text(c["How it connects"]),
      beforeIntro: beforeLines.filter((l) => !l.startsWith("- ")).join(" "),
      before: beforeLines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2)),
      roadTest: text(c["Road test"]),
    };
  }
  return {
    draft: !/^Status:\s*approved/im.test(md),
    intro: { line: text(intro["Line"]), forge: text(intro["Forge"]), parts: text(intro["Parts"]) },
    chapter,
    cards,
  };
}

