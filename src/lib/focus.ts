/**
 * My focus: a client works on one or two development opportunities at a time, and that's it.
 * Each focus is one 30-day cycle (DevelopmentCycle) in slot 1 or 2. Its plan, its five week 1 answers,
 * who finds out and its check-ins all live on the cycle, so nothing new has to be learned.
 *
 * The self-assessment shows where the client is on each rule. The goal is a 5 on every one.
 */
import type { PillarKey } from "@/content/types";

export const MAX_FOCUSES = 2;
export const FOCUS_SOURCES = { WATCH: "From my self-assessment", FEEDBACK: "From my feedback", COACH: "From my coach", OWN: "My own" } as const;
export type FocusSource = keyof typeof FOCUS_SOURCES;

const KEYS: PillarKey[] = ["F", "O", "R", "G", "E"];

type Scores = { f: number; o: number; r: number; g: number; e: number; revisedF?: number | null; revisedO?: number | null; revisedR?: number | null; revisedG?: number | null; revisedE?: number | null };

/** Each pillar's score, using the client's revised score where they gave one. */
export function pillarScores(a: Scores): Record<PillarKey, number> {
  return { F: a.revisedF ?? a.f, O: a.revisedO ?? a.o, R: a.revisedR ?? a.r, G: a.revisedG ?? a.g, E: a.revisedE ?? a.e };
}

/** The lowest-scored rule, used only to order focus ideas. The goal is a 5 on every rule; nothing is labeled a weakness. */
export function lowestRule(a: Scores | null | undefined, skip: string[] = []): PillarKey | null {
  if (!a) return null;
  const s = pillarScores(a);
  // A second focus starts from the lowest rule not already being worked on.
  const keys = KEYS.filter((k) => !skip.includes(k));
  const from = keys.length ? keys : KEYS;
  return from.reduce((low, k) => (s[k] < s[low] ? k : low), from[0]);
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
