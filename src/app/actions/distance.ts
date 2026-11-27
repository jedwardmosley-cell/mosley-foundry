"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parse, pillarKey, score } from "@/lib/validation";
import { FORGE_LINES } from "@/content/forgeLines";
import type { PillarKey } from "@/content/types";
import { getContent } from "@/content";
import { RULE_ORDER, PROOF_QUESTION, RULE_TARGET, EVIDENCE_NOTE_FALLBACK, evidenceHeuristic, shuffled, PRESSURE_TYPES, writtenReport, type DistanceReport, type ReportRule, type Evidence, type Pressure } from "@/lib/distance";
import { DISTANCE_SCENARIOS, seatFor } from "@/content/distanceScenarios";
import { aiAvailable, distanceScenarioAI, evidenceCheckAI, distanceReportAI } from "@/lib/ai";

const participant = () => requireUser("PARTICIPANT");
const base = (runId: string) => `/assessment/check/${runId}`;
const fromStart = (fd: FormData) => fd.get("from") === "start";
const q = (fd: FormData) => (fromStart(fd) ? "&from=start" : "");

/** The person's own run, with its rules, or nothing. */
async function myRun(userId: string, runId: string) {
  const run = await db.distanceRun.findFirst({ where: { id: runId, userId }, include: { rules: true } });
  if (!run) throw new Error("Not found");
  return run;
}

/** The AI is used only when it's set up, the person allows it, and they allow their identity to go to it. */
async function aiAllowed(userId: string) {
  if (!aiAvailable()) return false;
  const [p, id] = await Promise.all([
    db.profile.findUnique({ where: { userId }, select: { aiEnabled: true } }),
    db.identityProfile.findUnique({ where: { userId }, select: { aiUse: true } }),
  ]);
  return p?.aiEnabled !== false && id?.aiUse !== false;
}

/**
 * Starts the check, or picks up an unfinished one. Every rule needs its line first:
 * the check measures the person against their own future self, so a missing line sends them back to write it.
 */
export async function startDistance(fd: FormData) {
  const u = await participant();
  const kind = fd.get("kind") === "DAY30" ? "DAY30" : "SETUP";
  const cycleId = String(fd.get("cycleId") ?? "") || null;
  const profile = await db.profile.findUnique({ where: { userId: u.id } });
  const missing = FORGE_LINES.filter((l) => !String(profile?.[l.field] ?? "").trim());
  if (missing.length) {
    const letters = missing.map((l) => l.pillar).join("");
    // In the kickoff they go back to the five lines inside the kickoff; elsewhere, to Who I am.
    redirect(fromStart(fd) ? `/start?step=1&part=2&missingLines=${letters}` : `/identity?missingLines=${letters}#forge`);
  }
  const open = await db.distanceRun.findFirst({ where: { userId: u.id, completedAt: null, kind }, orderBy: { startedAt: "desc" }, include: { rules: true } });
  if (open) redirect(`${base(open.id)}?${resumeAt(open.rules)}${q(fd)}`);
  const previous = await db.distanceRun.findFirst({ where: { userId: u.id, completedAt: { not: null } }, orderBy: { completedAt: "desc" }, select: { id: true } });
  const run = await db.distanceRun.create({
    data: {
      userId: u.id, kind, cycleId, previousRunId: kind === "DAY30" ? previous?.id ?? null : null,
      rules: { create: FORGE_LINES.map((l) => ({ pillar: l.pillar, line: String(profile?.[l.field] ?? "").trim() })) },
    },
  });
  redirect(`${base(run.id)}?rule=F&step=road${q(fd)}`);
}

/** Where to pick up an unfinished run: the first rule and check not yet answered. */
function resumeAt(rules: { pillar: string; position: number | null; proof: string; pressure: string }[]) {
  for (const k of RULE_ORDER) {
    const r = rules.find((x) => x.pillar === k);
    if (!r || r.position == null) return `rule=${k}&step=road`;
    if (!r.proof.trim()) return `rule=${k}&step=proof`;
    if (!r.pressure) return `rule=${k}&step=pressure`;
  }
  return "rule=E&step=pressure";
}

/** Check 1: where you are on the road. */
export async function saveRoad(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ runId: z.string(), pillar: pillarKey, position: score }), fd);
  await myRun(u.id, d.runId);
  await db.distanceRule.update({ where: { runId_pillar: { runId: d.runId, pillar: d.pillar } }, data: { position: d.position } });
  redirect(`${base(d.runId)}?rule=${d.pillar}&step=proof${q(fd)}`);
}

/**
 * Check 2: prove it. The answer is checked for a real moment. A close position (4 or 5) with no real moment gets a note,
 * and the person chooses: add a moment, move their position, or keep going. Nothing is blocked.
 * The pressure test for this rule is prepared at the same time, so the next screen is ready.
 */
export async function saveProof(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ runId: z.string(), pillar: pillarKey, proof: z.string().trim().max(3000).default("") }), fd);
  const run = await myRun(u.id, d.runId);
  const rule = run.rules.find((r) => r.pillar === d.pillar)!;
  const position = rule.position ?? 3;
  const useAi = await aiAllowed(u.id);
  const [check] = await Promise.all([
    (async () => {
      const ai = useAi && d.proof ? await evidenceCheckAI({ line: rule.line, question: PROOF_QUESTION[d.pillar], answer: d.proof, position }).catch(() => null) : null;
      if (ai) return ai;
      const evidence = d.proof ? evidenceHeuristic(d.proof) : "missing";
      return { evidence, note: evidence !== "concrete" && position >= 4 ? EVIDENCE_NOTE_FALLBACK : "" };
    })(),
    ensureScenario(u.id, d.runId, d.pillar, useAi),
  ]);
  await db.distanceRule.update({ where: { id: rule.id }, data: { proof: d.proof, evidence: check.evidence, evidenceNote: check.note } });
  redirect(`${base(d.runId)}?rule=${d.pillar}&step=${check.note ? "proof&look=1" : "pressure"}${q(fd)}`);
}

/** After the note: keep the answer as it is and go on to the pressure test. */
export async function keepProof(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ runId: z.string(), pillar: pillarKey }), fd);
  await myRun(u.id, d.runId);
  await ensureScenario(u.id, d.runId, d.pillar, await aiAllowed(u.id));
  redirect(`${base(d.runId)}?rule=${d.pillar}&step=pressure${q(fd)}`);
}

/**
 * Check 3's situation, made once and kept, so a reload shows the same one in the same order.
 * The AI builds it from their seat, their line and their own words; if it can't, a written one for their seat is used.
 */
async function ensureScenario(userId: string, runId: string, pillar: PillarKey, useAi: boolean) {
  const rule = await db.distanceRule.findUnique({ where: { runId_pillar: { runId, pillar } } });
  if (!rule || rule.scenario) return;
  const [identity, cycles, { pack }] = await Promise.all([
    db.identityProfile.findUnique({ where: { userId }, select: { role: true } }),
    db.developmentCycle.findMany({ where: { userId }, orderBy: { startDate: "desc" }, take: 5, select: { pillar: true, oldResponse: true, feeling: true, gap: true } }),
    getContent(),
  ]);
  // Their own words from the focus questions, from this rule's focus when there is one, otherwise their latest.
  const own = cycles.find((c) => c.pillar === pillar && (c.oldResponse || c.feeling)) ?? cycles.find((c) => c.oldResponse || c.feeling);
  const seat = identity?.role?.trim() || "";
  const ruleName = pack.pillars.find((p) => p.key === pillar)?.name ?? pillar;
  let made: { scenario: string; options: { type: string; text: string }[] } | null = null;
  let source = "written";
  if (useAi) {
    made = await distanceScenarioAI({ seat: seat || "their own life", ruleName, ruleLetter: pillar, line: rule.line, oldResponse: own?.oldResponse ?? "", feeling: own?.feeling ?? "", hard: own?.gap ?? "", target: RULE_TARGET[pillar] }).catch(() => null);
    if (made) source = "ai";
  }
  if (!made) {
    const w = DISTANCE_SCENARIOS[seatFor(seat)][pillar];
    made = { scenario: w.scenario, options: PRESSURE_TYPES.map((t) => ({ type: t, text: w.options[t] })) };
  }
  await db.distanceRule.update({ where: { id: rule.id }, data: { scenario: JSON.stringify({ scenario: made.scenario, options: shuffled(made.options) }), scenarioSource: source } });
}

/** Check 3: the pressure test. The type of the chosen option is kept; the labels are never shown. Then the next rule, or the end. */
export async function savePressure(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ runId: z.string(), pillar: pillarKey, option: z.coerce.number().int().min(0).max(3) }), fd);
  const run = await myRun(u.id, d.runId);
  const rule = run.rules.find((r) => r.pillar === d.pillar)!;
  const shown = JSON.parse(rule.scenario || "{}") as { options?: { type: string }[] };
  const type = shown.options?.[d.option]?.type;
  if (!type) redirect(`${base(d.runId)}?rule=${d.pillar}&step=pressure${q(fd)}`);
  await db.distanceRule.update({ where: { id: rule.id }, data: { pressure: type } });
  const next = RULE_ORDER[RULE_ORDER.indexOf(d.pillar) + 1];
  if (next) redirect(`${base(d.runId)}?rule=${next}&step=road${q(fd)}`);
  await finishRun(u.id, d.runId);
  redirect(`${base(d.runId)}/done${fromStart(fd) ? "?from=start" : ""}`);
}

/** Closes the run. The five positions are also kept in the older format, so setup progress, choosing a focus and the season page keep working. */
async function finishRun(userId: string, runId: string) {
  const run = await myRun(userId, runId);
  if (run.completedAt) return;
  const pos = (k: PillarKey) => run.rules.find((r) => r.pillar === k)?.position ?? 1;
  const [a, report] = await Promise.all([
    db.assessment.create({ data: { userId, instrument: "FORGE_DISTANCE", f: pos("F"), o: pos("O"), r: pos("R"), g: pos("G"), e: pos("E") } }),
    writeReport(userId, run),
  ]);
  await db.distanceRun.update({ where: { id: runId }, data: { completedAt: new Date(), assessmentId: a.id, report: JSON.stringify(report) } });
}

/**
 * The distance report. The app works out which rule each section points at; the AI writes the words.
 * If the AI isn't allowed, fails, or its answer doesn't pass the checks, the written report is used.
 */
async function writeReport(userId: string, run: Awaited<ReturnType<typeof myRun>>): Promise<DistanceReport> {
  const { pack } = await getContent();
  const rules: ReportRule[] = RULE_ORDER.map((k) => {
    const r = run.rules.find((x) => x.pillar === k);
    return {
      pillar: k, name: pack.pillars.find((p) => p.key === k)?.name ?? k, line: r?.line ?? "",
      position: r?.position ?? 1, evidence: (r?.evidence ?? "") as Evidence | "", pressure: (r?.pressure ?? "") as Pressure | "", partnerRating: r?.partnerRating ?? null,
    };
  });
  const partner = null; // asked for in the partner view, which comes next
  const written = writtenReport(rules, partner);
  if (!(await aiAllowed(userId))) return written;
  const ai = await distanceReportAI(rules, partner).catch(() => null);
  return ai ? { ...ai, keys: written.keys, source: "ai" } : written;
}
