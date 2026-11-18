import Link from "next/link";
import { saveAssessment, reviseAssessment } from "@/app/actions/participant";
import type { getContent } from "@/content";
import type { PillarKey } from "@/content/types";
import { PillarMark, Source } from "./ui";
import { Submit } from "./Submit";
import { DictationHint } from "./Picks";
import { RuleAccordion } from "./RuleAccordion";

type Content = Awaited<ReturnType<typeof getContent>>;

/**
 * The self-assessment, on one page: the deep work of FORGE.
 * Each rule shows the client's own line from their statement and all five levels in full,
 * so they rate themselves against who they said they are, with the real definitions in front of them.
 * Used on the Rules of the Road and inside the kickoff. With reviseId, it updates the ratings of that assessment.
 */
export function AssessmentForm({ pack, entrepreneur, useEntre, instrument, next, lines = {}, role, defaults, reviseId }: {
  pack: Content["pack"];
  entrepreneur: Content["entrepreneur"];
  useEntre: boolean;
  instrument: string;
  next?: string;
  /** The client's own line for each rule, from the Driver's Seat. */
  lines?: Partial<Record<PillarKey, string>>;
  role?: string;
  /** Current scores, when updating. */
  defaults?: Record<PillarKey, number>;
  reviseId?: string;
}) {
  return (
    <form id="forge-rating" action={reviseId ? reviseAssessment : saveAssessment} className="space-y-3">
      <RuleAccordion formId="forge-rating" />
      {reviseId ? <input type="hidden" name="id" value={reviseId} /> : <input type="hidden" name="instrument" value={instrument} />}
      {next && <input type="hidden" name="next" value={next} />}
      {pack.pillars.map((p, i) => {
        const e = useEntre ? entrepreneur!.pillars[p.key] : null;
        const mine = lines[p.key]?.trim();
        return (
          // One rule at a time: the first is open, and picking a level opens the next (RuleAccordion).
          <details key={p.key} data-rule={p.key} open={!defaults && i === 0} className="card group scroll-mt-20">
          <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <PillarMark k={p.key} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block h2">{p.name}</span>
              <span data-pick className="block text-sm text-ink-soft">{defaults ? `${defaults[p.key]} · ${p.anchors.find((a) => a.score === defaults[p.key])?.level ?? ""}` : "Not rated yet"}</span>
            </span>
            <span aria-hidden className="text-ink-mute transition group-open:rotate-90">›</span>
          </summary>
          <fieldset className="mt-4">
            <legend className="sr-only">{p.name}</legend>
            <p className="muted text-[15px]">{e?.tagline ?? p.definition}</p>

            <div className="mt-5 rounded-2xl bg-ink/[0.04] px-4 py-3">
              <p className="text-xs text-ink-mute">{role ? `What I wrote, as ${role}` : "What I wrote"}</p>
              {mine
                ? <p className="mt-1 font-serif text-[17px] leading-snug text-heading">{mine}</p>
                : <p className="mt-1 text-[15px] text-ink-soft">You haven&apos;t written this line yet. <Link href="/identity" className="btn-link">Write it in Who&apos;s behind the wheel</Link>, or rate yourself without it.</p>}
            </div>

            <div className="mt-5">
              <p className="label">How true is this of you this past month?</p>
              <div className="space-y-2">
                {p.anchors.map((an) => (
                  <label key={an.score} className="block cursor-pointer">
                    <input type="radio" name={p.key} value={an.score} data-level={an.level} required defaultChecked={defaults?.[p.key] === an.score} className="peer sr-only" />
                    <span className="flex gap-3 rounded-2xl border border-ink/10 bg-field p-3.5 transition hover:border-navy/40 peer-checked:border-navy peer-checked:bg-navy/[0.06] peer-checked:ring-2 peer-checked:ring-navy/30 peer-focus-visible:ring-4 peer-focus-visible:ring-navy/20">
                      <span className="w-6 shrink-0 font-serif text-xl text-heading">{an.score}</span>
                      <span>
                        <span className="block text-[15px] font-medium text-heading">{an.level}</span>
                        <span className="mt-0.5 block text-[14px] leading-snug text-ink-soft">{an.text}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {!reviseId && (
              <details className="mt-5">
                <summary className="cursor-pointer text-sm text-link">Add a reflection <span className="text-ink-mute">(optional)</span></summary>
                <label className="block mt-2">
                  <span className="block text-[14px] text-ink-soft mb-2">{e?.reflection ?? p.reflection}</span>
                  <textarea name={`refl${p.key}`} className="textarea" maxLength={4000} />
                  <DictationHint />
                </label>
              </details>
            )}
          </fieldset>
          </details>
        );
      })}
      <div className="flex flex-wrap items-center gap-4 pt-3">
        <Submit className="btn-primary shrink-0">{reviseId ? "Save my ratings" : "See my profile"}</Submit>
        <p className="text-sm muted">Your answers are private. You decide later what, if anything, your coach sees.</p>
      </div>
      {pack.kind !== "licensed" && !useEntre && <Source>Draft placeholder</Source>}
    </form>
  );
}
