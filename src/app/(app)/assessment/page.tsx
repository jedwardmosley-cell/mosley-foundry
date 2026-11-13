import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { saveAssessment } from "@/app/actions/participant";
import { scoresFrom, total } from "@/lib/forge";
import { fmt } from "@/lib/dates";
import { PageHeader, PillarMark, Draft, Source } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { DictationHint } from "@/components/Picks";

export const metadata = { title: "Where I am" };

export default async function AssessmentPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const u = await requireUser("PARTICIPANT");
  const { pack, entrepreneur } = await getContent();
  const profile = await db.profile.findUnique({ where: { userId: u.id } });
  const past = await db.assessment.findMany({ where: { userId: u.id, isSecondOpinion: false }, orderBy: { completedAt: "desc" } });
  const useEntre = profile?.pathway === "ENTREPRENEURIAL" && !!entrepreneur;
  const instrument = pack.assessmentStatus === "draft" ? "FORGE_DRAFT" : useEntre ? "FORGE_ENTREPRENEUR" : "FORGE_PERSONAL";

  return (
    <>
      <PageHeader eyebrow={useEntre ? "FORGE self-assessment · Step 2 · for entrepreneurs" : "FORGE self-assessment · Step 2"} title="Where I am">
        {useEntre ? entrepreneur!.intro.slice(0, 3).map((t) => <p key={t} className="mb-2">{t}</p>) : (
          <p>Tap a score from 1 to 5 for each pillar. Score what you did this past month. The short lines under each score show what it looks like.</p>
        )}
      </PageHeader>

      {pack.assessmentStatus === "draft" && (
        <div className="card mb-6 border-alert/30 bg-alert-soft/40">
          <Draft>Draft assessment</Draft>
          <p className="mt-2 text-sm">The licensed content pack is not installed on this server, so this is a placeholder assessment for testing only. It is not the author&apos;s instrument and is not validated.</p>
        </div>
      )}

      {past.length > 0 && (
        <div className="card mb-6">
          <p className="eyebrow">Previous readings</p>
          <ul className="mt-2 divide-y divide-line">
            {past.map((a) => (
              <li key={a.id} className="py-2 flex justify-between">
                <Link href={`/assessment/${a.id}`} className="btn-link">{fmt(a.completedAt, { month: "short", day: "numeric", year: "numeric" })}</Link>
                <span className="muted text-sm">{total(scoresFrom(a))} / 25</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pack.threeNote && !useEntre && <p className="quote mb-6">{pack.threeNote}</p>}

      <form action={saveAssessment} className="space-y-6">
        <input type="hidden" name="instrument" value={instrument} />
        {next === "start" && <input type="hidden" name="next" value="/start" />}
        {next === "season" && <input type="hidden" name="next" value="/season" />}
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
                      <span className="block rounded-xl border border-line bg-surface py-3 text-center font-serif text-lg peer-checked:bg-navy peer-checked:text-white peer-checked:border-navy peer-focus-visible:ring-2 peer-focus-visible:ring-navy/40">{n}</span>
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
          <Submit>See my profile</Submit>
          <p className="text-sm muted">Your answers are private. You decide later what, if anything, your coach sees.</p>
        </div>
        {pack.kind !== "licensed" && !useEntre && <Source>Draft placeholder</Source>}
      </form>
    </>
  );
}
