/**
 * The FORGE distance check ("Where I am"): how close the driver you were this week is to the person in your own line.
 * Pure logic, shared by the pages, the actions and the tests. Positions are stored 1 to 5 and never shown as numbers.
 */
import type { PillarKey } from "@/content/types";

export const RULE_ORDER: PillarKey[] = ["F", "O", "R", "G", "E"];

/** The five road positions, as people see them. Index 0 is position 1. */
export const POSITIONS = ["Still parked", "Pulling out", "On the road", "Closing the distance", "Driving like them"] as const;
export const positionWord = (p: number | null | undefined) => (p && p >= 1 && p <= 5 ? POSITIONS[p - 1] : "");

/** Check 2: one proof question per rule. */
export const PROOF_QUESTION: Record<PillarKey, string> = {
  F: "Where did your time actually go this week compared to where you said you're headed? Name one thing.",
  O: "If someone watched you this week, would they recognize the person in your line? What would they have seen?",
  R: "Think of the day you were most tired this week. Did your reason still pull you, or did you run on willpower? What happened?",
  G: "Name one thing you're still holding onto that the future you has let go of.",
  E: "When did pressure last hit this week? What did you do in the first few minutes?",
};

/** Check 3: what each rule's pressure test aims at. Passed to the scenario prompt. */
export const RULE_TARGET: Record<PillarKey, string> = {
  F: "a tempting detour that would pull time or energy away from where they're headed",
  O: "a visible moment where someone would notice whether they act like the future self",
  R: "a tired, low-energy day when only their reason can carry them",
  G: "a moment that requires the exact thing they need to learn or let go of",
  E: "a pressure moment that triggers the feeling they named",
};

export type Pressure = "future_self" | "white_knuckle" | "avoidance" | "autopilot";
export type Evidence = "concrete" | "vague" | "missing";
export const PRESSURE_TYPES: Pressure[] = ["autopilot", "white_knuckle", "avoidance", "future_self"];

/** Worse first: autopilot is furthest from the future self, then avoidance, then white-knuckle. */
const PRESSURE_RANK: Record<Pressure, number> = { autopilot: 0, avoidance: 1, white_knuckle: 2, future_self: 3 };
const EVIDENCE_RANK: Record<Evidence, number> = { missing: 0, vague: 1, concrete: 2 };

export type RuleResult = { pillar: PillarKey; position: number; evidence: Evidence | ""; pressure: Pressure | ""; partnerRating?: number | null };

const pr = (p: Pressure | "") => (p ? PRESSURE_RANK[p] : 0);
const er = (e: Evidence | "") => (e ? EVIDENCE_RANK[e] : 0);

/** Widest gap: lowest position, then the worse pressure answer, then the weaker proof. */
export function widestGap(rules: RuleResult[]): PillarKey | null {
  if (!rules.length) return null;
  return [...rules].sort((a, b) => a.position - b.position || pr(a.pressure) - pr(b.pressure) || er(a.evidence) - er(b.evidence) || RULE_ORDER.indexOf(a.pillar) - RULE_ORDER.indexOf(b.pillar))[0].pillar;
}

/** Closest: where position, proof and pressure test all agree. If none agree fully, the best of the rest. Never the widest gap. */
export function closest(rules: RuleResult[]): PillarKey | null {
  const wide = widestGap(rules);
  const pool = rules.filter((r) => r.pillar !== wide);
  if (!pool.length) return null;
  const agree = pool.filter((r) => r.pressure === "future_self" && r.evidence === "concrete");
  const from = agree.length ? agree : pool;
  return [...from].sort((a, b) => b.position - a.position || pr(b.pressure) - pr(a.pressure) || er(b.evidence) - er(a.evidence) || RULE_ORDER.indexOf(a.pillar) - RULE_ORDER.indexOf(b.pillar))[0].pillar;
}

/** Where answers disagree: placed close (4 or 5) but the pressure test wasn't the future self, or the proof was thin. */
export function disagreesAt(r: RuleResult) {
  return r.position >= 4 && ((r.pressure !== "" && r.pressure !== "future_self") || r.evidence === "vague" || r.evidence === "missing");
}
export function disagreement(rules: RuleResult[]): PillarKey | null {
  const flagged = rules.filter(disagreesAt);
  if (!flagged.length) return null;
  // The sharpest one: highest position, then the furthest pressure answer, then the thinnest proof.
  return [...flagged].sort((a, b) => b.position - a.position || pr(a.pressure) - pr(b.pressure) || er(a.evidence) - er(b.evidence))[0].pillar;
}

/** Blind spot: the biggest difference between their own position and the partner's rating, both on a 0 to 1 scale. */
export function blindSpot(rules: RuleResult[]): PillarKey | null {
  const rated = rules.filter((r) => r.partnerRating != null);
  if (!rated.length) return null;
  const gap = (r: RuleResult) => Math.abs((r.position - 1) / 4 - ((r.partnerRating as number) - 1) / 3);
  const top = [...rated].sort((a, b) => gap(b) - gap(a))[0];
  return gap(top) > 0.2 ? top.pillar : null;
}

/** A plain check for a concrete moment, used when the AI isn't available. */
export function evidenceHeuristic(answer: string): Evidence {
  const t = answer.trim();
  if (t.length < 8 || /^(i\s*)?(don'?t know|dont know|not sure|n\/?a|idk|nothing|none|no)\.?$/i.test(t)) return "missing";
  const when = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|yesterday|today|tonight|this morning|last night|last week|this week|at \d|\d{1,2}(:\d\d)?\s?(am|pm)|o'clock|meeting|call|email|text|lunch|dinner|breakfast)\b/i;
  const story = /\b(when (i|my|we|she|he|they)|i (said|told|asked|called|went|stopped|skipped|walked|wrote|sat|took|chose|decided|snapped|yelled|left))\b/i;
  return when.test(t) || story.test(t) ? "concrete" : "vague";
}

export const EVIDENCE_NOTE_FALLBACK = "You placed yourself close, but you couldn't name a real moment yet. Add one, or move your position to where this week put you.";

/** Shuffles the four options for display. The order is stored, so a reload shows the same order. */
export function shuffled<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
