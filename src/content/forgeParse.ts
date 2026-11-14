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
  // The author's text comes first. The app's notes and cards follow, each under its own top heading.
  const cut = (h: string) => { const i = md.search(new RegExp(`^# ${h}\\s*$`, "m")); return i < 0 ? md.length : i; };
  const appAt = Math.min(cut("App notes"), cut("Cards"));
  const book = sections(md.slice(0, appAt), 2);
  const app = md.slice(appAt);
  const notes = sections(app.slice(0, Math.max(0, cut("Cards") - appAt)), 2);
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
  for (const [k, body] of Object.entries(sections(app.slice(Math.max(0, cut("Cards") - appAt)), 2))) {
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
  };
}

