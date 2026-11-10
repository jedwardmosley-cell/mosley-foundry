import type { ContentPack } from "@/content/types";
import { NIRS_WEEKS, type CycleWeek } from "@/content/program";
import { daysBetween } from "./dates";

export const CYCLE_TEMPLATES = {
  WORKBOOK_30: { name: "30-Day Implementation Plan", source: "Personal Application Workbook, Section Seven" },
  NIRS_30: { name: "Name It, Interrupt It, Replace It, Sustain It", source: "Build brief (FORGE Application Workbook assignments pending)" },
} as const;
export type CycleTemplate = keyof typeof CYCLE_TEMPLATES;

export function cycleWeeks(template: string, pack: ContentPack): { weeks: CycleWeek[]; decide?: string } {
  if (template === "WORKBOOK_30" && pack.thirtyDayPlan.length) {
    const weeks = pack.thirtyDayPlan
      .filter((w) => w.label.startsWith("Week"))
      .map((w, i) => ({ week: i + 1, phase: w.focus, work: w.work, status: "source" as const }));
    return { weeks, decide: pack.thirtyDayPlan.find((w) => w.label === "Day 30")?.work };
  }
  return { weeks: NIRS_WEEKS, decide: pack.thirtyDayPlan.find((w) => w.label === "Day 30")?.work };
}

/** Day 1..30 of the cycle (clamped), and the week 1..4 it falls in. Days 29-30 are review days in week 4. */
export function cyclePosition(startDate: Date, today = new Date()) {
  const day = Math.min(Math.max(daysBetween(startDate, today) + 1, 1), 30);
  const week = Math.min(Math.ceil(day / 7), 4);
  return { day, week, finished: daysBetween(startDate, today) + 1 > 30 };
}

/**
 * Practice evidence, worded so a missed day is information, not failure.
 * Counts Done and Partial as practice; "Not yet" is shown, never penalized.
 */
export function practiceSummary(checkIns: { status: string | null }[]) {
  const done = checkIns.filter((c) => c.status === "DONE").length;
  const partial = checkIns.filter((c) => c.status === "PARTIAL").length;
  const notYet = checkIns.filter((c) => c.status === "NOT_YET").length;
  return { done, partial, notYet, practiced: done + partial, logged: checkIns.length };
}
