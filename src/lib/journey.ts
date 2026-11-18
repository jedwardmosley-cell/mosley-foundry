import "server-only";
import { db } from "./db";
import { cyclePosition, cycleWeeks } from "./cycle";
import { getContent } from "@/content";
import { mondayOf } from "./dates";

/**
 * The client's path through the app, in one order:
 * FORGE: who I am, where I am today. Discipline by Design: my focus (one or two, each for 30 days), then my road.
 * The daily check-in opens once all four are done, so the system is built before the first check-in. The bar shows what is done and what comes next.
 */
export const JOURNEY_STEPS = [
  { key: "identity", label: "The Driver's Seat", next: "Claim who you are", href: "/identity" },
  { key: "today", label: "The Rules of the Road", next: "Rate yourself on the five rules", href: "/assessment" },
  { key: "drive", label: "The Windshield", next: "Choose one or two things to work on", href: "/focus" },
  { key: "road", label: "The Vehicle Controls", next: "Build your system", href: "/road" },
] as const;
export type JourneyKey = (typeof JOURNEY_STEPS)[number]["key"];

export type Journey = {
  done: Record<JourneyKey, boolean>;
  /** The first step not done, or null once all four are. */
  current: JourneyKey | null;
  cycle: { day: number; week: number; phase: string; finished: boolean; seasonMonth: number | null } | null;
  /** What the Driver's Seat still needs, in the client's words: "your seat", "how big a turn", "your statement". */
  identityMissing: string[];
  /** What the system (the Vehicle Controls) still needs: "a daily routine", "a weekly planning time", "an accountability partner". */
  roadMissing: string[];
  /** The Mirrors: this week's look back is saved. A weekly habit, not a setup step, so it never gates the check-in. */
  lookedBack: boolean;
};

/** The core of Discipline by Design, built before the first check-in. The other areas of the Vehicle Controls come after. */
export const SYSTEM_PIECES = [
  { key: "daily", label: "A daily routine", missing: "a daily routine" },
  { key: "weekly", label: "A weekly planning time", missing: "a weekly planning time" },
  { key: "partner", label: "An accountability partner", missing: "an accountability partner" },
] as const;
export type SystemPiece = (typeof SYSTEM_PIECES)[number]["key"];

/** Which pieces of the system are in place. */
export async function systemPieces(userId: string): Promise<Record<SystemPiece, boolean>> {
  const [daily, weekly, partner] = await Promise.all([
    db.commitment.count({ where: { userId, active: true, area: "ROUTINES" } }),
    db.commitment.count({ where: { userId, active: true, area: "WEEKLY" } }),
    db.relationship.count({ where: { ownerId: userId, active: true, role: "ACCOUNTABILITY_PARTNER" } }),
  ]);
  return { daily: daily > 0, weekly: weekly > 0, partner: partner > 0 };
}

/** The three things the Driver's Seat needs to count as done. */
export function identityGaps(identity: { role: string; level: string; becoming: string } | null, statement: string) {
  return [
    !identity?.role.trim() && "your seat",
    !identity?.level && "how big a turn",
    !(statement.trim() || identity?.becoming.trim()) && "My statement",
  ].filter(Boolean) as string[];
}

export async function getJourney(userId: string): Promise<Journey> {
  const [identity, profile, assessment, system, cycle, weekly] = await Promise.all([
    db.identityProfile.findUnique({ where: { userId }, select: { role: true, level: true, becoming: true } }),
    db.profile.findUnique({ where: { userId }, select: { forgeStatement: true, priorityPillar: true } }),
    db.assessment.findFirst({ where: { userId, isSecondOpinion: false }, select: { id: true } }),
    systemPieces(userId),
    db.developmentCycle.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: [{ slot: "asc" }, { startDate: "desc" }], select: { startDate: true, template: true, seasonMonth: true, setupDoneAt: true } }),
    db.weeklyReflection.findUnique({ where: { userId_weekOf: { userId, weekOf: mondayOf() } }, select: { id: true } }),
  ]);
  const done: Record<JourneyKey, boolean> = {
    // Who I am is done with a role, a kind of change and a statement. The five help build the statement.
    identity: identityGaps(identity, profile?.forgeStatement ?? "").length === 0,
    today: !!assessment,
    // The Vehicle Controls are the system: a daily routine, a weekly planning time and an accountability partner.
    road: system.daily && system.weekly && system.partner,
    drive: !!cycle?.setupDoneAt,
  };
  let c: Journey["cycle"] = null;
  if (cycle) {
    const pos = cyclePosition(cycle.startDate);
    const { pack } = await getContent();
    const phase = cycleWeeks(cycle.template, pack).weeks[pos.week - 1]?.phase ?? "";
    c = { ...pos, phase, seasonMonth: cycle.seasonMonth };
  }
  const current = JOURNEY_STEPS.find((s) => !done[s.key])?.key ?? null;
  const roadMissing = SYSTEM_PIECES.filter((p) => !system[p.key]).map((p) => p.missing);
  return { done, current, cycle: c, identityMissing: identityGaps(identity, profile?.forgeStatement ?? ""), roadMissing, lookedBack: !!weekly };
}
