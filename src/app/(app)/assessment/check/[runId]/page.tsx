import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import type { PillarKey } from "@/content/types";
import { PILLAR_FILL, PillarMark } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { DictationHint } from "@/components/Picks";
import { saveRoad, saveProof, keepProof, savePressure } from "@/app/actions/distance";
import { RULE_ORDER, POSITIONS, PROOF_QUESTION } from "@/lib/distance";

export const metadata = { title: "Where I am" };

const STEPS = ["road", "proof", "pressure"] as const;
type Step = (typeof STEPS)[number];

/**
 * The distance check, one rule at a time (F, O, R, G, E), three checks per rule:
 * where you are on the road, prove it, and the pressure test. The person's own line is at the top of every screen.
 */
export default async function DistanceCheck({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<{ rule?: string; step?: string; look?: string; from?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { runId } = await params;
  const sp = await searchParams;
  const run = await db.distanceRun.findFirst({ where: { id: runId, userId: u.id }, include: { rules: true } });
  if (!run) notFound();
  const from = sp.from === "start" ? "start" : "";
  const fromQ = from ? "&from=start" : "";
  if (run.completedAt) redirect(`/assessment/check/${run.id}/done${from ? "?from=start" : ""}`);
  const k = (RULE_ORDER.includes(sp.rule as PillarKey) ? sp.rule : "F") as PillarKey;
  const step = (STEPS.includes(sp.step as Step) ? sp.step : "road") as Step;
  const rule = run.rules.find((r) => r.pillar === k);
  if (!rule) notFound();
  // Each check needs the one before it: no proof without a position, no pressure test without the proof step.
  if (step !== "road" && rule.position == null) redirect(`/assessment/check/${run.id}?rule=${k}&step=road${fromQ}`);
  const { pack } = await getContent();
  const name = pack.pillars.find((p) => p.key === k)?.name ?? k;
  const tone = { "--pc": `var(${PILLAR_FILL[k].cssVar})` } as CSSProperties;
  const ruleIndex = RULE_ORDER.indexOf(k);
  const stepIndex = STEPS.indexOf(step);
  const back = stepIndex > 0 ? `?rule=${k}&step=${STEPS[stepIndex - 1]}${fromQ}` : ruleIndex > 0 ? `?rule=${RULE_ORDER[ruleIndex - 1]}&step=pressure${fromQ}` : null;
  const hidden = (
    <>
      <input type="hidden" name="runId" value={run.id} />
      <input type="hidden" name="pillar" value={k} />
      {from && <input type="hidden" name="from" value="start" />}
    </>
  );

  return (
    <div style={tone}>
      {/* Where they are in the check: the five rules, and the three checks of this one. */}
      <nav aria-label="Your progress" className="mb-6">
        <ol className="flex items-center gap-2">
          {RULE_ORDER.map((r, i) => (
            <li key={r} className={`flex items-center gap-1.5 text-sm ${r === k ? "font-semibold text-heading" : i < ruleIndex ? "text-ink-soft" : "text-ink-mute"}`}>
              <PillarMark k={r} size="sm" />
              <span className="sr-only">{pack.pillars.find((p) => p.key === r)?.name}{i < ruleIndex ? ", done" : r === k ? ", now" : ""}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[13px] text-ink-mute">{name}: {step === "road" ? "where you are on the road" : step === "proof" ? "prove it" : "pressure test"}</p>
      </nav>

      <div className="mb-6 rounded-2xl px-4 py-3.5" style={{ background: "rgb(var(--pc) / 0.08)" }}>
        <p className="section-label" style={{ color: "rgb(var(--pc))" }}>My {k} line</p>
        <p className="mt-1.5 font-serif text-[18px] leading-snug text-heading">{rule.line}</p>
      </div>

      {step === "road" && (
        <form action={saveRoad}>
          {hidden}
          <h1 className="font-book text-[28px] leading-[1.15] text-heading text-balance">How close is the driver you were this week to this person?</h1>
          <fieldset className="mt-6">
            <legend className="sr-only">Where you are on the road</legend>
            {/* The road: five stops from parked to driving like them. Words only, never numbers. */}
            <ol className="relative ml-3 border-l-[3px] border-dashed border-ink/20 pl-6">
              {POSITIONS.map((label, i) => (
                <li key={label} className="relative py-1.5">
                  <label className="group flex cursor-pointer items-center gap-3">
                    <input type="radio" name="position" value={i + 1} required defaultChecked={rule.position === i + 1} className="peer sr-only" />
                    <span aria-hidden className="absolute -left-[33px] h-4 w-4 rounded-full border-2 border-ink/25 bg-paper transition peer-checked:border-[rgb(var(--pc))] peer-checked:bg-[rgb(var(--pc))] peer-focus-visible:ring-4 peer-focus-visible:ring-navy/20" />
                    <span className="flex-1 rounded-xl border border-line/70 bg-card px-4 py-3 text-[17px] text-ink-soft transition group-hover:border-ink/25 peer-checked:border-[rgb(var(--pc))] peer-checked:text-heading peer-checked:font-medium">{label}</span>
                  </label>
                </li>
              ))}
            </ol>
          </fieldset>
          <div className="mt-6 flex items-center gap-4">
            <Submit className="btn-primary">Next</Submit>
            {back && <Link href={back} className="text-sm btn-link">Back</Link>}
          </div>
        </form>
      )}

      {step === "proof" && (
        <>
          <form action={saveProof}>
            {hidden}
            <h1 className="font-book text-[26px] leading-[1.2] text-heading text-balance"><label htmlFor="proof">{PROOF_QUESTION[k]}</label></h1>
            <p className="mt-2 text-sm text-ink-mute">You said: {POSITIONS[(rule.position ?? 1) - 1]}. <Link href={`?rule=${k}&step=road${fromQ}`} className="btn-link">Change</Link></p>
            <textarea id="proof" name="proof" defaultValue={rule.proof} maxLength={3000} rows={5} className="textarea mt-4" placeholder="A real moment: when it was, who was there, what you did." />
            <DictationHint />
            <div className="mt-5 flex items-center gap-4">
              <Submit className="btn-primary">Next</Submit>
              {back && <Link href={back} className="text-sm btn-link">Back</Link>}
            </div>
          </form>
          {/* The look: a close position with no real moment. They choose; nothing is blocked. */}
          {sp.look && rule.evidenceNote && (
            <section role="status" className="mt-6 rounded-2xl border border-line/70 bg-card px-5 py-4">
              <p className="text-[15px] text-ink">{rule.evidenceNote}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                <span className="text-sm text-ink-soft">Add a moment above and press Next, or:</span>
                <Link href={`?rule=${k}&step=road${fromQ}`} className="text-sm btn-link">Move my position</Link>
                <form action={keepProof}>{hidden}<button className="text-sm btn-link">Keep it and go on</button></form>
              </div>
            </section>
          )}
        </>
      )}

      {step === "pressure" && <Pressure rule={rule} hidden={hidden} back={back} last={k === "E"} proofHref={`?rule=${k}&step=proof${fromQ}`} />}
    </div>
  );
}

/** Check 3: one situation and four ways to drive through it, in the order they were shuffled. No labels. */
function Pressure({ rule, hidden, back, last, proofHref }: { rule: { scenario: string; pressure: string }; hidden: React.ReactNode; back: string | null; last: boolean; proofHref: string }) {
  let s: { scenario: string; options: { type: string; text: string }[] } | null = null;
  try { s = rule.scenario ? JSON.parse(rule.scenario) : null; } catch { s = null; }
  if (!s) {
    return <p className="text-[15px] text-ink-soft">This situation didn&apos;t load. <Link href={proofHref} className="btn-link">Go back one step</Link> and press Next again.</p>;
  }
  return (
    <form action={savePressure}>
      {hidden}
      <p className="section-label">This week, imagine this</p>
      <p className="mt-2 font-book text-[22px] leading-[1.35] text-heading">{s.scenario}</p>
      <fieldset className="mt-5">
        <legend className="mb-3 text-[15px] text-ink-soft">What would you do?</legend>
        <div className="space-y-2.5">
          {s.options.map((o, i) => (
            <label key={i} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line/70 bg-card px-4 py-3 transition hover:border-ink/25 has-[:checked]:border-[rgb(var(--pc))]">
              <input type="radio" name="option" value={i} required defaultChecked={rule.pressure === o.type} className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--pc))]" />
              <span className="text-[16px] text-ink">{o.text}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-sm text-ink-mute">Pick what you&apos;d most likely do this week.</p>
      <div className="mt-5 flex items-center gap-4">
        <Submit className="btn-primary">{last ? "Finish" : "Next rule"}</Submit>
        {back && <Link href={back} className="text-sm btn-link">Back</Link>}
      </div>
    </form>
  );
}
