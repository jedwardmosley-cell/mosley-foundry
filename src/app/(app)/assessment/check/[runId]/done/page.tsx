import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import type { PillarKey } from "@/content/types";
import { PILLAR_FILL, PillarMark, PageHeader } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { setPriority } from "@/app/actions/participant";
import { RULE_ORDER, positionWord, readReport, writtenReport, type Evidence, type Pressure, type ReportRule } from "@/lib/distance";

export const metadata = { title: "Where I am" };

/**
 * The distance report: closest to the future you, the widest gap, where the answers disagree, and (once a partner answers)
 * what they see. Then each rule's place on the road, in words, and one tap to make the widest gap the 30-day focus.
 */
export default async function DistanceDone({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<{ from?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { runId } = await params;
  const sp = await searchParams;
  const run = await db.distanceRun.findFirst({ where: { id: runId, userId: u.id }, include: { rules: true } });
  if (!run) notFound();
  if (!run.completedAt) redirect(`/assessment/check/${run.id}`);
  const { pack } = await getContent();
  const nameOf = (k: string) => pack.pillars.find((p) => p.key === k)?.name ?? k;
  const rules: ReportRule[] = RULE_ORDER.map((k) => {
    const r = run.rules.find((x) => x.pillar === k);
    return { pillar: k, name: nameOf(k), line: r?.line ?? "", position: r?.position ?? 1, evidence: (r?.evidence ?? "") as Evidence | "", pressure: (r?.pressure ?? "") as Pressure | "", partnerRating: r?.partnerRating ?? null };
  });
  // A run finished before reports were written gets the written one, worked out the same way.
  const report = readReport(run.report) ?? writtenReport(rules, null);
  const wide = report.keys.widest;
  const fromStart = sp.from === "start";
  const sections = [
    { title: "Closest to the future you", text: report.closest, k: report.keys.closest },
    { title: "Widest gap", text: report.widest_gap, k: report.keys.widest },
    { title: "Where your answers disagree", text: report.disagreement, k: report.keys.disagree },
    { title: "What your partner sees", text: report.partner, k: report.keys.blind },
  ].filter((s) => s.text);

  return (
    <>
      <PageHeader eyebrow="Where I am" title="Here's where you are on the road">
        Measured against your own five lines: the person you said you&apos;re becoming.
      </PageHeader>

      <div className="space-y-3">
        {sections.map((s) => (
          <section key={s.title} data-report className="rounded-2xl border border-line/70 bg-card px-5 py-4" style={s.k ? ({ "--pc": `var(${PILLAR_FILL[s.k as PillarKey].cssVar})` } as CSSProperties) : undefined}>
            <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-heading">
              {s.k && <PillarMark k={s.k} size="sm" />}
              {s.title}
            </h2>
            <p className="mt-2 text-[16px] leading-relaxed text-ink">{s.text}</p>
          </section>
        ))}
      </div>

      {wide && (
        <section className="mt-6 rounded-2xl px-5 py-5" style={{ "--pc": `var(${PILLAR_FILL[wide].cssVar})`, background: "rgb(var(--pc) / 0.1)" } as CSSProperties}>
          <p className="font-book text-[22px] leading-snug text-heading">Your widest gap is {nameOf(wide)}. Want to make it your 30-day focus?</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            <form action={setPriority}>
              <input type="hidden" name="pillar" value={wide} />
              {fromStart && <input type="hidden" name="next" value="/start" />}
              <Submit>Make it my focus</Submit>
            </form>
            <Link href={fromStart ? "/start?step=3" : "/cycle/new"} className="text-sm btn-link">Choose a different rule</Link>
          </div>
        </section>
      )}

      <h2 className="section-label mt-8">Each rule on the road</h2>
      <ol className="mt-2 divide-y divide-line/60 border-y border-line/60">
        {rules.map((r) => (
          <li key={r.pillar} className="flex items-start gap-3.5 py-4">
            <PillarMark k={r.pillar} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink-mute">{r.name}</span>
              <span className="block font-book text-[21px] leading-tight text-heading">{positionWord(r.position)}</span>
              <span className="mt-1 block text-[14px] text-ink-soft line-clamp-2">{r.line}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {fromStart ? <Link href="/start?step=3" className="btn-quiet">Continue setup</Link> : <Link href="/assessment" className="text-sm btn-link">Back to the Rules of the Road</Link>}
      </div>
    </>
  );
}
