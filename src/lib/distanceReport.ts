/** Writing the distance report, shared by finishing the check and by the partner's answers arriving. Server only. */
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { aiAvailable, distanceReportAI } from "@/lib/ai";
import { RULE_ORDER, writtenReport, type DistanceReport, type Evidence, type Pressure, type ReportRule } from "@/lib/distance";

/** The AI is used only when it's set up, the person allows it, and they allow their identity to go to it. */
export async function aiAllowedFor(userId: string) {
  if (!aiAvailable()) return false;
  const [p, id] = await Promise.all([
    db.profile.findUnique({ where: { userId }, select: { aiEnabled: true } }),
    db.identityProfile.findUnique({ where: { userId }, select: { aiUse: true } }),
  ]);
  return p?.aiEnabled !== false && id?.aiUse !== false;
}

type RunForReport = {
  userId: string;
  partnerStatus: string;
  partnerRelId: string | null;
  rules: { pillar: string; line: string; position: number | null; evidence: string; pressure: string; partnerRating: number | null }[];
};

/** The rules, named, in order F, O, R, G, E, ready for the report. */
export async function reportRules(run: RunForReport): Promise<ReportRule[]> {
  const { pack } = await getContent();
  return RULE_ORDER.map((k) => {
    const r = run.rules.find((x) => x.pillar === k);
    return {
      pillar: k, name: pack.pillars.find((p) => p.key === k)?.name ?? k, line: r?.line ?? "",
      position: r?.position ?? 1, evidence: (r?.evidence ?? "") as Evidence | "", pressure: (r?.pressure ?? "") as Pressure | "", partnerRating: r?.partnerRating ?? null,
    };
  });
}

/** The partner for the report: their first name, and whether they've answered. Nobody asked yet means no partner section. */
export async function reportPartner(run: RunForReport) {
  if (run.partnerStatus === "NONE" || run.partnerStatus === "READY" || !run.partnerRelId) return null;
  const rel = await db.relationship.findUnique({ where: { id: run.partnerRelId }, select: { name: true } });
  return { name: firstName(rel?.name ?? "your partner"), answered: run.partnerStatus === "ANSWERED" };
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * The app works out which rule each section points at; the AI writes the words.
 * If the AI isn't allowed, fails, or its answer doesn't pass the checks, the written report is used.
 */
export async function writeReport(run: RunForReport): Promise<DistanceReport> {
  const [rules, partner] = await Promise.all([reportRules(run), reportPartner(run)]);
  const written = writtenReport(rules, partner);
  if (!(await aiAllowedFor(run.userId))) return written;
  const ai = await distanceReportAI(rules, partner).catch(() => null);
  return ai ? { ...ai, keys: written.keys, source: "ai" } : written;
}
