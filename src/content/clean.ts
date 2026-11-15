import type { ContentPack, EntrepreneurPack } from "./types";

/**
 * The author asked that Ed's name, and Ed's mentor, not appear in the app. The licensed pack is
 * the book's text as uploaded, so it is cleaned here as it loads: the lesson about the mentor is
 * left out, sentences about him are dropped, and Ed becomes "a leader" or "the leader".
 */
const RULES: [RegExp, string][] = [
  [/,\s*whose potential I see the way Ed's mentor saw his/g, ""],
  [/\s*Ed's mentor[^.]*\.(\s*Someone did that for you\.)?(\s*Do it for someone else\.)?/g, ""],
  [/\bEd's Lessons\b/g, "Lessons from the road"],
  [/\bEd at the Insurance Company\b/g, "The Leader at the Insurance Company"],
  [/\bThe (\w+) Ed coaches\b/g, "The $1"],
  [/(^|[.!?]\s+)Ed's\b/g, "$1The leader's"],
  [/(^|[.!?]\s+)Ed\b/g, "$1A leader"],
  [/\bEd's\b/g, "the leader's"],
  [/\bEd\b/g, "the leader"],
];

export function cleanText(s: string): string {
  return RULES.reduce((t, [re, to]) => t.replace(re, to), s).replace(/\s{2,}/g, " ").trim();
}

/** The app calls F, O, R, G and E the five rules. The workbook says "pillar"; the book's own chapter text is left as written. */
export function ruleWords(s: string): string {
  return s.replace(/\b[Yy]our FORGE statement\b/g, "My statement").replace(/\bFORGE statement\b/g, "My statement").replace(/\bpillars\b/g, "rules").replace(/\bPillars\b/g, "Rules").replace(/\bpillar\b/g, "rule").replace(/\bPillar\b/g, "Rule");
}

const BOOK_TEXT = new Set(["rule", "chapters"]);

function walk<T>(v: T, book = false): T {
  if (typeof v === "string") return (book ? cleanText(v) : ruleWords(cleanText(v))) as T;
  if (Array.isArray(v)) return v.map((x) => walk(x, book)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, book || BOOK_TEXT.has(k))])) as T;
  return v;
}

export function cleanPack(pack: ContentPack): ContentPack {
  const p = walk(pack);
  // FORGE in the Wild (the workbook's composite profiles) is retired at the author's request.
  return { ...p, profiles: [], edsLessons: p.edsLessons.filter((e) => !/^The Mentor$/i.test(e.title) && !/\bmentor\b/i.test(e.setup ?? "")) };
}

export function cleanEntrepreneur(p: EntrepreneurPack): EntrepreneurPack {
  return walk(p);
}
