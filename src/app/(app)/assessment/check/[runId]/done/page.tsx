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
import { ASKABLE_ROLES, MAX_PARTNERS, firstName, reportPartners, reportRules } from "@/lib/distanceReport";
import { PARTNER_WORDS, joinNames, partnerQuestion, partnerWord, positionWord, readReport, writtenReport } from "@/lib/distance";

export const metadata = { title: "Where I am" };

/**
 * The distance report: closest to the future you, the widest gap, where the answers disagree, and (once a partner answers)
 * what they see. Then each rule's place on the road, in words, and one tap to make the widest gap the 30-day focus.
 */
export default async function DistanceDone({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<{ from?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { runId } = await params;
  const sp = await searchParams;
  const run = await db.distanceRun.findFirst({ where: { id: runId, userId: u.id }, include: { rules: true, partners: { orderBy: { createdAt: "asc" } } } });
  if (!run) notFound();
  if (!run.completedAt) redirect(`/assessment/check/${run.id}`);
  const { pack } = await getContent();
  const nameOf = (k: string) => pack.pillars.find((p) => p.key === k)?.name ?? k;
  const rules = await reportRules(run);
  // A run finished before reports were written gets the written one, worked out the same way.
  const report = readReport(run.report) ?? writtenReport(rules, reportPartners(run));
  const wide = report.keys.widest;
  // The partners: the ones asked about this check (up to three), and the people they could still ask.
  const asked = run.partners;
  const askable = asked.length < MAX_PARTNERS
    ? (await db.relationship.findMany({ where: { ownerId: u.id, active: true, role: { in: ASKABLE_ROLES } }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true } })).filter((r) => !asked.some((p) => p.relId === r.id))
    : [];
  const emails = Object.fromEntries((await db.relationship.findMany({ where: { id: { in: asked.map((p) => p.relId) } }, select: { id: true, email: true } })).map((r) => [r.id, r.email]));
  const answeredNames = asked.filter((p) => p.status === "ANSWERED").map((p) => firstName(p.name));
  const me = firstName(u.name);
  const fromStart = sp.from === "start";
  const sections = [
    { title: "Closest to the future you", text: report.closest, k: report.keys.closest },
    { title: "Widest gap", text: report.widest_gap, k: report.keys.widest },
    { title: "Where your answers disagree", text: report.disagreement, k: report.keys.disagree },
    { title: answeredNames.length ? `What ${joinNames(answeredNames)} ${answeredNames.length > 1 ? "see" : "sees"}` : asked.length > 1 ? "Your partners' view" : "Your partner's view", text: report.partner, k: report.keys.blind },
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

      {/* Check 4: the partners' view. One message per person, up to three, and they see exactly what goes out first. */}
      <section id="partner" className="mt-6 rounded-2xl border border-line/70 bg-card px-5 py-5">
        <h2 className="text-[17px] font-semibold text-heading">How someone else sees it</h2>
        {!asked.length && (
          <p className="mt-2 text-[15px] text-ink-soft">Ask your accountability partner, or up to {MAX_PARTNERS} people, for an honest view. Each one sees your five lines and answers one question for each: how often you look like that person. You&apos;ll see each message before it goes.</p>
        )}
        {asked.length > 0 && (
          <ul className="mt-3 space-y-4">
            {asked.map((p) => {
              const pn = firstName(p.name);
              return (
                <li key={p.id} className="border-t border-line/60 pt-4 first:border-0 first:pt-0">
                  {p.status === "READY" && (
                    <>
                      <p className="text-[15px] text-ink-soft">Here&apos;s exactly what {pn} will get. Nothing goes out until you send it.</p>
                      <div className="mt-3"><PartnerSend partnerId={p.id} message={p.message} email={emails[p.relId]} /></div>
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-medium text-heading">The page the link opens</summary>
                        <div className="mt-2 rounded-xl border border-dashed border-line px-4 py-3.5 text-[14px] text-ink-soft">
                          <p className="font-semibold text-heading">{me} asked for your honest view</p>
                          <p className="mt-1">Your five lines, each with: &ldquo;{partnerQuestion(me)}&rdquo; {PARTNER_WORDS.join(", ")}. An example is optional.</p>
                          <ul className="mt-2 list-disc space-y-0.5 pl-5">{rules.map((r) => <li key={r.pillar}>{r.line}</li>)}</ul>
                        </div>
                      </details>
                      <p className="mt-3 text-[14px] text-ink-soft">{pn} sees nothing else: not where you placed yourself, your answers, this report, or what anyone else said.</p>
                      <form action={cancelPartner} className="mt-3">
                        <input type="hidden" name="partnerId" value={p.id} />
                        {fromStart && <input type="hidden" name="from" value="start" />}
                        <button className="text-sm btn-link">Don&apos;t ask {pn}</button>
                      </form>
                    </>
                  )}
                  {p.status === "SENT" && (
                    <>
                      <p className="text-[15px] text-ink"><span className="font-medium">{pn}:</span> waiting on their answers.</p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-ink-soft">Send it again</summary>
                        <div className="mt-3"><PartnerSend partnerId={p.id} message={p.message} email={emails[p.relId]} className="btn-quiet" /></div>
                      </details>
                    </>
                  )}
                  {p.status === "ANSWERED" && <p className="text-[15px] text-ink"><span className="font-medium">{pn}:</span> answered. What they said is next to each rule below.</p>}
                </li>
              );
            })}
          </ul>
        )}
        {askable.length > 0 ? (
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
        ) : asked.length < MAX_PARTNERS && (
          <p className="mt-3 text-[15px] text-ink-soft">{asked.length ? "To ask someone else, add" : "Add"} an accountability partner on <Link href="/network" className="btn-link">People</Link>, then come back here.</p>
        )}
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
              {(r.partnerViews ?? []).map((v) => (
                <span key={v.name} className="mt-1.5 block text-[14px] text-ink">
                  {v.name} said: {partnerWord(v.rating)}
                  {v.example && <span className="block italic text-ink-soft">&ldquo;{v.example}&rdquo;</span>}
                </span>
              ))}
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
