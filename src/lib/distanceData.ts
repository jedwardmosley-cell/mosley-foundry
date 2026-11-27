import { db } from "@/lib/db";
import type { PillarKey } from "@/content/types";
import { readReport } from "@/lib/distance";

/** The widest gap from the distance check behind this assessment, if it came from one. */
export async function widestGapFor(assessmentId: string | null | undefined): Promise<PillarKey | null> {
  if (!assessmentId) return null;
  const run = await db.distanceRun.findFirst({ where: { assessmentId }, select: { report: true } });
  return readReport(run?.report)?.keys.widest ?? null;
}
