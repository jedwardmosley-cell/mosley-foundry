/**
 * My focus: a client works on one or two development opportunities at a time, and that's it.
 * Each focus is one 30-day cycle (DevelopmentCycle) in slot 1 or 2. Its plan, its five week 1 answers,
 * who finds out and its check-ins all live on the cycle, so nothing new has to be learned.
 *
 * The FORGE reading gives a watch area: the pillar (or two) rated lowest. A watch area is something to
 * keep in view while working on a focus. It is never a task of its own.
 */
import type { PillarKey } from "@/content/types";

export const MAX_FOCUSES = 2;
export const FOCUS_SOURCES = { WATCH: "From my watch area", FEEDBACK: "From my feedback", COACH: "From my coach", OWN: "My own" } as const;
export type FocusSource = keyof typeof FOCUS_SOURCES;

const KEYS: PillarKey[] = ["F", "O", "R", "G", "E"];

type Scores = { f: number; o: number; r: number; g: number; e: number; revisedF?: number | null; revisedO?: number | null; revisedR?: number | null; revisedG?: number | null; revisedE?: number | null };

/** Each pillar's score, using the client's revised score where they gave one. */
export function pillarScores(a: Scores): Record<PillarKey, number> {
  return { F: a.revisedF ?? a.f, O: a.revisedO ?? a.o, R: a.revisedR ?? a.r, G: a.revisedG ?? a.g, E: a.revisedE ?? a.e };
}

/**
 * The watch area: the lowest-rated pillar, or the two lowest when they tie.
 * When three or more tie for lowest, or every score is the same, nothing stands out and there is none.
 */
export function watchAreas(a: Scores | null | undefined, chosen?: string | null): PillarKey[] {
  // When nothing stands out on its own, the pillar the client picked from a tie is the watch area.
  const picked = chosen && KEYS.includes(chosen as PillarKey) ? [chosen as PillarKey] : [];
  if (!a) return picked;
  const s = pillarScores(a);
  const min = Math.min(...KEYS.map((k) => s[k]));
  const low = KEYS.filter((k) => s[k] === min);
  return low.length <= 2 && low.length < KEYS.length ? low : picked;
}

/** The strengths: the pillars rated highest, when they stand above the rest. */
export function strengths(a: Scores | null | undefined): PillarKey[] {
  if (!a) return [];
  const s = pillarScores(a);
  const max = Math.max(...KEYS.map((k) => s[k]));
  const top = KEYS.filter((k) => s[k] === max);
  return top.length < KEYS.length ? top.slice(0, 2) : [];
}

/** The free slot for a new focus, or null when the client already has two. */
export function freeSlot(active: { slot: number }[]): 1 | 2 | null {
  const used = new Set(active.map((c) => c.slot));
  return !used.has(1) ? 1 : !used.has(2) ? 2 : null;
}

/** The focus in a few words, for cycles made before focuses had a title. */
export function focusTitle(c: { title: string; focus: string; plan: string }) {
  return c.title || c.focus || c.plan || "My focus";
}

/** A day's status for one focus: the first focus uses status, the second uses status2. */
export function statusFor(row: { cycleId: string | null; status: string; cycle2Id?: string | null; status2?: string }, cycleId: string): string {
  if (row.cycle2Id === cycleId) return row.status2 ?? "";
  if (row.cycleId === cycleId) return row.status;
  return "";
}
