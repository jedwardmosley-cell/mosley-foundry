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
  /** Core idea: its first sentence is the line; the rest follows it. The forge: the heat and the hammer. */
  intro: { line: string; core: string; forge: string; glance: string; parts: string };
  chapter: Partial<Record<PillarKey, { heading: string; paragraphs: string[] }>>;
  /** The book's Selected sources, by group. */
  bookSources: { group: string; items: string[] }[];
  cards: Partial<Record<PillarKey, ForgeCard>>;
  /** The author's teaching guide: the Library, the full guide per rule, and What this means. */
  guide: ForgeGuide | null;
};

export type GuideSection = { heading: string; md: string };
export type ForgeGuide = {
  title: string;
  /** Sections before the five rules, like What FORGE is. */
  intro: GuideSection[];
  /** Each rule's teaching, without its In practice line. */
  rules: Partial<Record<PillarKey, GuideSection & { practice: string }>>;
  /** Sections after the five rules, like How the five work together. */
  outro: GuideSection[];
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

/** Splits the file at its top headings (# Title): { title: body }. */
function topBlocks(md: string): Record<string, string> {
  return sections(md, 1);
}

function parseGuide(body: string | undefined): ForgeGuide | null {
  if (!body?.trim()) return null;
  const title = body.match(/^Title:\s*(.+)$/m)?.[1].trim() ?? "The FORGE Framework";
  const ORDER: PillarKey[] = ["F", "O", "R", "G", "E"];
  const intro: GuideSection[] = [], outro: GuideSection[] = [];
  const rules: ForgeGuide["rules"] = {};
  for (const [heading, raw] of Object.entries(sections(body, 2))) {
    // The closing line about the book becomes a linked footer on each page, so it is not repeated here.
    const md = raw.trim().replace(/\n*The full story behind each rule is in[^\n]*$/, "").trim();
    const k = heading.match(/^([FORGE]):/)?.[1] as PillarKey | undefined;
    if (k && ORDER.includes(k)) {
      const practice = md.match(/^\*\*In practice:\*\*\s*(.+)$/m)?.[1].trim() ?? "";
      rules[k] = { heading, md: md.replace(/^\*\*In practice:\*\*.*$/m, "").trim(), practice };
    } else (Object.keys(rules).length ? outro : intro).push({ heading, md });
  }
  return { title, intro, rules, outro };
}

export function parseForgeSource(md: string): ForgeSource {
  // The author's text comes first. The app's notes, cards and the guide follow, each under its own top heading.
  const top = topBlocks(md);
  const bookKey = Object.keys(top)[0] ?? "";
  const book = sections(top[bookKey] ?? md, 2);
  const app = [top["App notes"] ?? "", top["Cards"] ?? ""].join("\n");
  const notes = sections(top["App notes"] ?? "", 2);
  const leaveOut = (notes["Leave out"] ?? "").split("\n").filter((l) => l.trim().startsWith("- ")).map((l) => l.trim().slice(2).toLowerCase());
  const keep = (p: string) => !leaveOut.some((w) => p.toLowerCase().includes(w));

  const chapter: ForgeSource["chapter"] = {};
  const ORDER: PillarKey[] = ["F", "O", "R", "G", "E"];
  for (const [heading, body] of Object.entries(book)) {
    const m = heading.match(/^Rule (\d)\b/);
    if (m && ORDER[Number(m[1]) - 1]) chapter[ORDER[Number(m[1]) - 1]] = { heading, paragraphs: paras(body).filter(keep) };
  }
  const core = paras(book["Core idea"]);
  const firstSentence = core[0]?.match(/^[^.!?]+[.!?]/)?.[0] ?? "";
  const glanceKey = Object.keys(book).find((k) => /^FORGE at a Glance/i.test(k)) ?? "";
  const glance = paras(book[glanceKey]);
  const sourcesKey = Object.keys(book).find((k) => /^Selected sources/i.test(k)) ?? "";
  const bookSources = Object.entries(sections(book[sourcesKey] ?? "", 3)).map(([group, body]) => ({ group, items: paras(body) }));
  const lastE = chapter.E?.paragraphs.at(-1) ?? "";

  const cards: ForgeSource["cards"] = {};
  for (const [k, body] of Object.entries(sections(top["Cards"] ?? "", 2))) {
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
    draft: !/^Status:\s*approved/im.test(app),
    intro: {
      line: firstSentence,
      core: [core[0]?.slice(firstSentence.length).trim(), ...core.slice(1)].filter(Boolean).join("\n\n"),
      forge: text(book["The forge"]),
      glance: glance.filter((p) => !/^[FORGE], /.test(p)).join(" "),
      parts: /Five parts of one driver/.test(lastE) ? "Five parts of one driver." : "",
    },
    chapter,
    bookSources,
    cards,
    guide: parseGuide(top["Guide"]),
  };
}
