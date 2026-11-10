import type { ContentPack, EntrepreneurPack, PillarKey } from "@/content/types";
import { PILLAR_KEYS } from "@/content/types";

export type Scores = Record<PillarKey, number>;

export function scoresFrom(a: { f: number; o: number; r: number; g: number; e: number; revisedF?: number | null; revisedO?: number | null; revisedR?: number | null; revisedG?: number | null; revisedE?: number | null }): Scores {
  return {
    F: a.revisedF ?? a.f,
    O: a.revisedO ?? a.o,
    R: a.revisedR ?? a.r,
    G: a.revisedG ?? a.g,
    E: a.revisedE ?? a.e,
  };
}

export const total = (s: Scores) => PILLAR_KEYS.reduce((n, k) => n + s[k], 0);

/** Lowest pillar(s). Ties are returned together; the participant chooses (the workbook asks for a single lowest). */
export function lowest(s: Scores): PillarKey[] {
  const min = Math.min(...PILLAR_KEYS.map((k) => s[k]));
  return PILLAR_KEYS.filter((k) => s[k] === min);
}

export function isFlat(s: Scores) {
  return new Set(PILLAR_KEYS.map((k) => s[k])).size === 1;
}

export function interpret(pack: ContentPack, s: Scores, focus?: PillarKey) {
  const t = total(s);
  const band = pack.totalBands.find((b) => t >= b.min && t <= b.max) ?? null;
  const low = lowest(s);
  const key = focus ?? low[0];
  const p = pack.pillars.find((x) => x.key === key)!;
  const v = s[key];
  // Workbook ranges overlap at the boundaries (1-2, 2-3, ...). A score sits in the range it starts.
  const guidance = p.lowest.find((g) => v >= g.min && v < g.max) ?? p.lowest[p.lowest.length - 1];
  return { total: t, band, lowest: low, focus: key, guidance, flat: isFlat(s) };
}

export function entrepreneurPatterns(ep: EntrepreneurPack | null, s: Scores) {
  if (!ep) return [];
  return ep.patterns.filter((p) => {
    const hi = Math.min(...p.test.high.map((k) => s[k]));
    const lo = Math.max(...p.test.low.map((k) => s[k]));
    return hi >= 4 && lo <= 2;
  });
}
