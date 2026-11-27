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
import { PartnerSend } from "@/components/PartnerSend";
import { askPartner, cancelPartner } from "@/app/actions/partner";
import { firstName } from "@/lib/distanceReport";
import { RULE_ORDER, PARTNER_WORDS, partnerQuestion, partnerWord, positionWord, readReport, writtenReport, type Evidence, type Pressure, type ReportRule } from "@/lib/distance";

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
  // The partner: the one asked for this check, or the people they could ask.
  const [asked, askable] = await Promise.all([
    run.partnerRelId ? db.relationship.findUnique({ where: { id: run.partnerRelId }, select: { name: true, email: true } }) : null,
    run.partnerStatus === "NONE" ? db.relationship.findMany({ where: { ownerId: u.id, active: true, role: { in: ["ACCOUNTABILITY_PARTNER", "MENTOR"] } }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }) : [],
  ]);
  const partnerName = asked ? firstName(asked.name) : "";
  const me = firstName(u.name);
  const fromStart = sp.from === "start";
  const sections = [
    { title: "Closest to the future you", text: report.closest, k: report.keys.closest },
    { title: "Widest gap", text: report.widest_gap, k: report.keys.widest },
    { title: "Where your answers disagree", text: report.disagreement, k: report.keys.disagree },
    { title: run.partnerStatus === "ANSWERED" ? `What ${partnerName || "your partner"} sees` : "Your partner's view", text: report.partner, k: report.keys.blind },
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

      {/* Check 4: the partner's view. One message for the whole check, and they see exactly what goes out first. */}
      <section id="partner" className="mt-6 rounded-2xl border border-line/70 bg-card px-5 py-5">
        <h2 className="text-[17px] font-semibold text-heading">How someone else sees it</h2>
        {run.partnerStatus === "NONE" && (askable.length ? (
          <>
            <p className="mt-2 text-[15px] text-ink-soft">Ask your accountability partner for an honest view. They&apos;ll see your five lines and answer one question for each: how often you look like that person. You&apos;ll see the message before it goes.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {askable.map((p) => (
                <form key={p.id} action={askPartner}>
                  <input type="hidden" name="runId" value={run.id} />
                  <input type="hidden" name="relId" value={p.id} />
                  {fromStart && <input type="hidden" name="from" value="start" />}
                  <Submit className="btn-quiet">Ask {firstName(p.name)}</Submit>
                </form>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-[15px] text-ink-soft">Add an accountability partner on <Link href="/network" className="btn-link">People</Link>, then come back here to ask how they see you.</p>
        ))}
        {run.partnerStatus === "READY" && (
          <>
            <p className="mt-2 text-[15px] text-ink-soft">Here&apos;s exactly what {partnerName} will get. Nothing goes out until you send it.</p>
            <div className="mt-4"><PartnerSend runId={run.id} message={run.partnerMessage} email={asked?.email} /></div>
            <p className="mt-5 text-sm font-medium text-heading">The page the link opens</p>
            <div className="mt-1.5 rounded-xl border border-dashed border-line px-4 py-3.5 text-[14px] text-ink-soft">
              <p className="font-semibold text-heading">{me} asked for your honest view</p>
              <p className="mt-1">Your five lines, each with: &ldquo;{partnerQuestion(me)}&rdquo; {PARTNER_WORDS.join(", ")}. An example is optional.</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">{rules.map((r) => <li key={r.pillar}>{r.line}</li>)}</ul>
              <p className="mt-2">They see nothing else: not where you placed yourself, your answers, or this report.</p>
            </div>
            <form action={cancelPartner} className="mt-4">
              <input type="hidden" name="runId" value={run.id} />
              {fromStart && <input type="hidden" name="from" value="start" />}
              <button className="text-sm btn-link">Don&apos;t ask {partnerName}</button>
            </form>
          </>
        )}
        {run.partnerStatus === "SENT" && (
          <>
            <p className="mt-2 text-[15px] text-ink-soft">Waiting on {partnerName}. Their answers will show up here.</p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-ink-soft">Send it again</summary>
              <div className="mt-3"><PartnerSend runId={run.id} message={run.partnerMessage} email={asked?.email} className="btn-quiet" /></div>
            </details>
          </>
        )}
        {run.partnerStatus === "ANSWERED" && <p className="mt-2 text-[15px] text-ink-soft">{partnerName} answered. What they said is next to each rule below.</p>}
      </section>

      <h2 className="section-label mt-8">Each rule on the road</h2>
      <ol className="mt-2 divide-y divide-line/60 border-y border-line/60">
        {rules.map((r) => (
          <li key={r.pillar} className="flex items-start gap-3.5 py-4">
            <PillarMark k={r.pillar} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink-mute">{r.name}</span>
              <span className="block font-book text-[21px] leading-tight text-heading">{positionWord(r.position)}</span>
              <span className="mt-1 block text-[14px] text-ink-soft line-clamp-2">{r.line}</span>
              {r.partnerRating != null && <span className="mt-1.5 block text-[14px] text-ink">{partnerName} said: {partnerWord(r.partnerRating)}</span>}
              {run.rules.find((x) => x.pillar === r.pillar)?.partnerExample && <span className="mt-0.5 block text-[14px] italic text-ink-soft">&ldquo;{run.rules.find((x) => x.pillar === r.pillar)?.partnerExample}&rdquo;</span>}
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
