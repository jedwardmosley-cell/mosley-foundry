import "server-only";
import { db } from "./db";
import { cyclePosition, cycleWeeks } from "./cycle";
import { getContent } from "@/content";

/**
 * The client's path through the app, in one order:
 * FORGE: who I am, where I am today. Discipline by Design: my road, then the 30 days.
 * Every step stays optional. The bar only shows what is done and what comes next.
 */
export const JOURNEY_STEPS = [
  { key: "identity", label: "Who's behind the wheel", next: "Claim who you are", href: "/identity" },
  { key: "today", label: "Where I am", next: "See where you are today and pick one pillar", href: "/assessment" },
  { key: "road", label: "My road", next: "Design your road: one routine and one person", href: "/road" },
  { key: "drive", label: "30 days", next: "Start your 30 days", href: "/cycle" },
] as const;
export type JourneyKey = (typeof JOURNEY_STEPS)[number]["key"];

export type Journey = {
  done: Record<JourneyKey, boolean>;
  /** The first step not done, or null once the 30 days are under way. */
  current: JourneyKey | null;
  cycle: { day: number; week: number; phase: string; finished: boolean; seasonMonth: number | null } | null;
  /** What Who's behind the wheel still needs, in the client's words: "your seat", "how big a turn", "your statement". */
  identityMissing: string[];
};

/** The three things Who's behind the wheel needs to count as done. */
export function identityGaps(identity: { role: string; level: string; becoming: string } | null, statement: string) {
  return [
    !identity?.role.trim() && "your seat",
    !identity?.level && "how big a turn",
    !(statement.trim() || identity?.becoming.trim()) && "your statement",
  ].filter(Boolean) as string[];
}

export async function getJourney(userId: string): Promise<Journey> {
  const [identity, profile, assessment, commitments, people, cycle] = await Promise.all([
    db.identityProfile.findUnique({ where: { userId }, select: { role: true, level: true, becoming: true } }),
    db.profile.findUnique({ where: { userId }, select: { forgeStatement: true, priorityPillar: true } }),
    db.assessment.findFirst({ where: { userId, isSecondOpinion: false }, select: { id: true } }),
    db.commitment.count({ where: { userId, active: true } }),
    db.relationship.count({ where: { ownerId: userId, active: true } }),
    db.developmentCycle.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { startDate: "desc" }, select: { startDate: true, template: true, seasonMonth: true } }),
  ]);
  const done: Record<JourneyKey, boolean> = {
    // Who I am is done with a role, a kind of change and a statement. The five help build the statement.
    identity: identityGaps(identity, profile?.forgeStatement ?? "").length === 0,
    today: !!assessment && !!profile?.priorityPillar,
    road: commitments > 0 && people > 0,
    drive: !!cycle,
  };
  let c: Journey["cycle"] = null;
  if (cycle) {
    const pos = cyclePosition(cycle.startDate);
    const { pack } = await getContent();
    const phase = cycleWeeks(cycle.template, pack).weeks[pos.week - 1]?.phase ?? "";
    c = { ...pos, phase, seasonMonth: cycle.seasonMonth };
  }
  const current = done.drive ? null : (JOURNEY_STEPS.find((s) => !done[s.key])?.key ?? null);
  return { done, current, cycle: c, identityMissing: identityGaps(identity, profile?.forgeStatement ?? "") };
}
