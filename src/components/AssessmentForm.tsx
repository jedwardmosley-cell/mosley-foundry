import { saveAssessment } from "@/app/actions/participant";
import type { getContent } from "@/content";
import { PillarMark, Source } from "./ui";
import { Submit } from "./Submit";
import { DictationHint } from "./Picks";

type Content = Awaited<ReturnType<typeof getContent>>;

/**
 * The self-assessment: rate each rule from 1 to 5, with what 1, 3 and 5 look like.
 * Used on Where I am and inside the kickoff, so the client never leaves the kickoff to do it.
 */
export function AssessmentForm({ pack, entrepreneur, useEntre, instrument, next }: { pack: Content["pack"]; entrepreneur: Content["entrepreneur"]; useEntre: boolean; instrument: string; next?: string }) {
  return (
    <form action={saveAssessment} className="space-y-6">
      <input type="hidden" name="instrument" value={instrument} />
      {next && <input type="hidden" name="next" value={next} />}
      {pack.pillars.map((p) => {
        const e = useEntre ? entrepreneur!.pillars[p.key] : null;
        const brief = e?.brief ?? p.brief;
        return (
          <fieldset key={p.key} className="card">
            <legend className="sr-only">{p.name}</legend>
            <div className="flex items-start gap-3">
              <PillarMark k={p.key} size="lg" />
              <div>
                <h2 className="h2">{p.name}</h2>
                <p className="muted text-[15px]">{e?.tagline ?? p.definition}</p>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              {(["1", "3", "5"] as const).map((k) => (
                <div key={k} className="rounded-xl bg-paper p-3">
                  <dt className="font-serif text-lg text-heading">{k}</dt>
                  <dd className="text-[14px] leading-snug text-ink-soft mt-1">{brief[k]}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5">
              <span className="label">Rate yourself</span>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="cursor-pointer">
                    <input type="radio" name={p.key} value={n} required className="peer sr-only" />
                    <span className="block rounded-2xl bg-field py-3 text-center font-serif text-xl text-ink-soft transition hover:bg-navy/10 peer-checked:bg-navy peer-checked:text-white peer-checked:shadow-[0_8px_18px_-10px_rgb(var(--navy-deep)/0.8)] peer-focus-visible:ring-4 peer-focus-visible:ring-navy/20">{n}</span>
                  </label>
                ))}
              </div>
            </div>
            <details className="mt-5">
              <summary className="cursor-pointer text-sm text-link">Add a reflection <span className="text-ink-mute">(optional)</span></summary>
              <label className="block mt-2">
                <span className="block text-[14px] text-ink-soft mb-2">{e?.reflection ?? p.reflection}</span>
                <textarea name={`refl${p.key}`} className="textarea" maxLength={4000} />
                <DictationHint />
              </label>
            </details>
          </fieldset>
        );
      })}
      <div className="flex items-center gap-4">
        <Submit className="btn-primary shrink-0">See my profile</Submit>
        <p className="text-sm muted">Your answers are private. You decide later what, if anything, your coach sees.</p>
      </div>
      {pack.kind !== "licensed" && !useEntre && <Source>Draft placeholder</Source>}
    </form>
  );
}
