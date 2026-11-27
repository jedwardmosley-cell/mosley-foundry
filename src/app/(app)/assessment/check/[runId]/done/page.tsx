import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import type { PillarKey } from "@/content/types";
import { PILLAR_FILL, PillarMark, PageHeader } from "@/components/ui";
import { RULE_ORDER, positionWord } from "@/lib/distance";

export const metadata = { title: "Where I am" };

/** The end of the check: where they are on the road for each rule, in words. The written report comes next. */
export default async function DistanceDone({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<{ from?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { runId } = await params;
  const sp = await searchParams;
  const run = await db.distanceRun.findFirst({ where: { id: runId, userId: u.id }, include: { rules: true } });
  if (!run) notFound();
  if (!run.completedAt) redirect(`/assessment/check/${run.id}`);
  const { pack } = await getContent();
  return (
    <>
      <PageHeader eyebrow="Where I am" title="Here's where you are on the road">
        Measured against your own five lines: the person you said you&apos;re becoming.
      </PageHeader>
      <ol className="divide-y divide-line/60 border-y border-line/60">
        {RULE_ORDER.map((k) => {
          const r = run.rules.find((x) => x.pillar === k);
          return (
            <li key={k} className="flex items-start gap-3.5 py-4" style={{ "--pc": `var(${PILLAR_FILL[k as PillarKey].cssVar})` } as CSSProperties}>
              <PillarMark k={k} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink-mute">{pack.pillars.find((p) => p.key === k)?.name}</span>
                <span className="block font-book text-[21px] leading-tight text-heading">{positionWord(r?.position)}</span>
                <span className="mt-1 block text-[14px] text-ink-soft line-clamp-2">{r?.line}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-6">
        {sp.from === "start" ? <Link href="/start?step=3" className="btn-primary">Continue setup</Link> : <Link href="/assessment" className="btn-primary">Back to the Rules of the Road</Link>}
      </div>
    </>
  );
}
