import "server-only";
import { getContent } from "@/content";
import { PATHWAYS, RELATIONSHIP_ROLES, BLUEPRINT_AREAS, DAY30_DECISIONS } from "@/content/program";
import { loadParticipant } from "./participant";
import { scoresFrom, total } from "./forge";
import { practiceSummary } from "./cycle";
import { fmt } from "./dates";
import { db } from "./db";

/** Development summary for the participant's own export. Excludes the private journal and AI conversations. */
export async function developmentSummary(userId: string, name: string) {
  const d = await loadParticipant(userId);
  const cycles = await db.developmentCycle.findMany({ where: { userId }, orderBy: { startDate: "asc" } });
  const { pack } = await getContent();
  const L: string[] = [];
  const pName = (k: string) => pack.pillars.find((p) => p.key === k)?.name ?? k;
  L.push(`# Development Summary: ${name}`, `Both Hands on the Wheel · generated ${fmt(new Date(), { month: "long", day: "numeric", year: "numeric" })}`, "");
  if (d.profile) {
    L.push(`**Pathway:** ${PATHWAYS[d.profile.pathway as keyof typeof PATHWAYS]?.name}`);
    if (d.profile.priorityPillar) L.push(`**Development priority:** ${pName(d.profile.priorityPillar)}`);
    if (d.profile.destination) L.push("", "## Destination", d.profile.destination);
    if (d.profile.why) L.push("", "## Why", d.profile.why);
    if (d.profile.forgeStatement) L.push("", "## FORGE Statement", d.profile.forgeStatement);
  }
  if (d.assessments.length) {
    L.push("", "## FORGE self-assessments", "", "| Date | F | O | R | G | E | Total |", "|---|---|---|---|---|---|---|");
    for (const a of d.assessments) {
      const s = scoresFrom(a);
      L.push(`| ${fmt(a.completedAt, { month: "short", day: "numeric", year: "numeric" })} | ${s.F} | ${s.O} | ${s.R} | ${s.G} | ${s.E} | ${total(s)} |`);
    }
    L.push("", "_Self-rated development scores. Not a validated psychometric measure._");
  }
  if (d.goals.length) {
    L.push("", "## FORGE Action Plan");
    for (const g of d.goals) L.push(`- **${pName(g.pillar)}${g.segmentKey ? ` (segment ${g.segmentKey})` : ""}**: now: ${g.whereNow || "-"}; want: ${g.whereWant || "-"}; one move: ${g.oneMove || "-"}`);
  }
  if (d.commitments.length) {
    L.push("", "## Discipline by Design Blueprint");
    for (const c of d.commitments) L.push(`- ${BLUEPRINT_AREAS.find((a) => a.key === c.area)?.label}: ${c.title}${c.when ? ` (${c.when})` : ""}`);
  }
  if (d.relationships.length) {
    L.push("", "## Accountability network");
    for (const r of d.relationships) L.push(`- ${r.name}, ${RELATIONSHIP_ROLES[r.role as keyof typeof RELATIONSHIP_ROLES]}, every ${r.cadenceDays} days; check-ins held: ${r.checkIns.filter((c) => c.happened).length}`);
  }
  if (cycles.length) {
    L.push("", "## 30-day cycles");
    for (const c of cycles) {
      const ci = await db.dailyCheckIn.findMany({ where: { cycleId: c.id } });
      const s = practiceSummary(ci);
      L.push(`- ${pName(c.pillar)} from ${fmt(c.startDate, { month: "short", day: "numeric", year: "numeric" })}: ${s.done} done, ${s.partial} partial, ${s.notYet} not yet. ${c.status === "COMPLETED" ? `Day 30 decision: ${DAY30_DECISIONS[c.decision as keyof typeof DAY30_DECISIONS] ?? c.decision}.` : c.status.toLowerCase()}`);
      if (c.finalReview) L.push(`  - Final review: ${c.finalReview}`);
    }
  }
  if (d.weekly.length) {
    L.push("", "## Recent weekly reflections");
    for (const w of d.weekly) L.push(`- Week of ${fmt(w.weekOf)}: built: ${w.built || "-"}; avoided: ${w.avoided || "-"}; next: ${w.nextWeek || "-"}`);
  }
  L.push("", "_Private journal entries and AI conversations are not included in this export._");
  return L.join("\n");
}
