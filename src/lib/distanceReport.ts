/** Writing the distance report, shared by finishing the check and by partners' answers arriving. Server only. */
import { db } from "@/lib/db";
import { getContent } from "@/content";
import type { PillarKey } from "@/content/types";
import { aiAvailable, distanceReportAI } from "@/lib/ai";
import { RULE_ORDER, middle, writtenReport, type DistanceReport, type Evidence, type PartnerView, type Pressure, type ReportPartner, type ReportRule } from "@/lib/distance";

/** Up to three partners can be asked about one check. */
export const MAX_PARTNERS = 3;
/** The roles that can be asked for their view: the people someone named to hold them to it. */
export const ASKABLE_ROLES = ["ACCOUNTABILITY_PARTNER", "MENTOR"];

/** The AI is used only when it's set up, the person allows it, and they allow their identity to go to it. */
export async function aiAllowedFor(userId: string) {
  if (!aiAvailable()) return false;
  const [p, id] = await Promise.all([
    db.profile.findUnique({ where: { userId }, select: { aiEnabled: true } }),
    db.identityProfile.findUnique({ where: { userId }, select: { aiUse: true } }),
  ]);
  return p?.aiEnabled !== false && id?.aiUse !== false;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

type Answers = Partial<Record<PillarKey, { rating: number; example: string }>>;
/** One partner's stored answers, or nothing. */
export function readAnswers(raw: string): Answers {
  try { return raw ? (JSON.parse(raw) as Answers) : {}; } catch { return {}; }
}

type RunForReport = {
  userId: string;
  rules: { pillar: string; line: string; position: number | null; evidence: string; pressure: string }[];
  partners: { name: string; status: string; answers: string; createdAt: Date }[];
};

/** The partners that count for the report: sent or answered, oldest first. One still being written isn't out yet. */
export function partnersOut<T extends { status: string; createdAt: Date }>(partners: T[]) {
  return partners.filter((p) => p.status === "SENT" || p.status === "ANSWERED").sort((a, b) => +a.createdAt - +b.createdAt);
}

/** The rules, named, in order F, O, R, G, E, with what each partner said and the middle answer. */
export async function reportRules(run: RunForReport): Promise<ReportRule[]> {
  const { pack } = await getContent();
  const answered = partnersOut(run.partners).filter((p) => p.status === "ANSWERED").map((p) => ({ name: firstName(p.name), answers: readAnswers(p.answers) }));
  return RULE_ORDER.map((k) => {
    const r = run.rules.find((x) => x.pillar === k);
    const views: PartnerView[] = answered.flatMap((p) => (p.answers[k] ? [{ name: p.name, rating: p.answers[k]!.rating, example: p.answers[k]!.example ?? "" }] : []));
    return {
      pillar: k, name: pack.pillars.find((p) => p.key === k)?.name ?? k, line: r?.line ?? "",
      position: r?.position ?? 1, evidence: (r?.evidence ?? "") as Evidence | "", pressure: (r?.pressure ?? "") as Pressure | "",
      partnerRating: middle(views.map((v) => v.rating)), partnerViews: views,
    };
  });
}

export function reportPartners(run: RunForReport): ReportPartner[] {
  return partnersOut(run.partners).map((p) => ({ name: firstName(p.name), answered: p.status === "ANSWERED" }));
}

/**
 * The app works out which rule each section points at; the AI writes the words.
 * If the AI isn't allowed, fails, or its answer doesn't pass the checks, the written report is used.
 */
export async function writeReport(run: RunForReport): Promise<DistanceReport> {
  const rules = await reportRules(run);
  const partners = reportPartners(run);
  const written = writtenReport(rules, partners);
  if (!(await aiAllowedFor(run.userId))) return written;
  const ai = await distanceReportAI(rules, partners).catch(() => null);
  return ai ? { ...ai, keys: written.keys, source: "ai" } : written;
}

/** Writes the report again and keeps it, after a partner is sent the link or answers. */
export async function rewriteReport(runId: string) {
  const run = await db.distanceRun.findUniqueOrThrow({ where: { id: runId }, include: { rules: true, partners: true } });
  await db.distanceRun.update({ where: { id: runId }, data: { report: JSON.stringify(await writeReport(run)) } });
}
