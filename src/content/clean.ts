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

function walk<T>(v: T): T {
  if (typeof v === "string") return cleanText(v) as T;
  if (Array.isArray(v)) return v.map(walk) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) as T;
  return v;
}

export function cleanPack(pack: ContentPack): ContentPack {
  const p = walk(pack);
  return { ...p, edsLessons: p.edsLessons.filter((e) => !/^The Mentor$/i.test(e.title) && !/\bmentor\b/i.test(e.setup ?? "")) };
}

export function cleanEntrepreneur(p: EntrepreneurPack): EntrepreneurPack {
  return walk(p);
}
