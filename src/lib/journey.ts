import "server-only";
import { db } from "./db";
import { cyclePosition, cycleWeeks } from "./cycle";
import { getContent } from "@/content";

/**
 * The client's path through the app, in one order:
 * who I am, my FORGE identity, where I am today, my road (Discipline by Design), then the 30 days.
 * Every step stays optional. The bar only shows what is done and what comes next.
 */
export const JOURNEY_STEPS = [
  { key: "identity", label: "Who I am", next: "Claim who you are", href: "/identity" },
  { key: "lines", label: "FORGE identity", next: "Write your FORGE identity", href: "/plan" },
  { key: "today", label: "Where I am", next: "See where you are today and pick one pillar", href: "/assessment" },
  { key: "road", label: "My road", next: "Design your road: one routine and one person", href: "/blueprint" },
  { key: "drive", label: "30 days", next: "Start your 30 days", href: "/cycle" },
] as const;
export type JourneyKey = (typeof JOURNEY_STEPS)[number]["key"];

export type Journey = {
  done: Record<JourneyKey, boolean>;
  /** The first step not done, or null once the 30 days are under way. */
  current: JourneyKey | null;
  cycle: { day: number; week: number; phase: string; finished: boolean } | null;
};

export async function getJourney(userId: string): Promise<Journey> {
  const [identity, profile, assessment, commitments, people, cycle] = await Promise.all([
    db.identityProfile.findUnique({ where: { userId }, select: { userId: true } }),
    db.profile.findUnique({ where: { userId }, select: { destination: true, lineO: true, why: true, lineG: true, lineE: true, forgeStatement: true, priorityPillar: true } }),
    db.assessment.findFirst({ where: { userId, isSecondOpinion: false }, select: { id: true } }),
    db.commitment.count({ where: { userId, active: true } }),
    db.relationship.count({ where: { ownerId: userId, active: true } }),
    db.developmentCycle.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { startDate: "desc" }, select: { startDate: true, template: true } }),
  ]);
  const lines = profile ? [profile.destination, profile.lineO, profile.why, profile.lineG, profile.lineE].filter((x) => x.trim()).length : 0;
  const done: Record<JourneyKey, boolean> = {
    identity: !!identity,
    lines: !!profile?.forgeStatement.trim() || lines === 5,
    today: !!assessment && !!profile?.priorityPillar,
    road: commitments > 0 && people > 0,
    drive: !!cycle,
  };
  let c: Journey["cycle"] = null;
  if (cycle) {
    const pos = cyclePosition(cycle.startDate);
    const { pack } = await getContent();
    const phase = cycleWeeks(cycle.template, pack).weeks[pos.week - 1]?.phase ?? "";
    c = { ...pos, phase };
  }
  const current = done.drive ? null : (JOURNEY_STEPS.find((s) => !done[s.key])?.key ?? null);
  return { done, current, cycle: c };
}
