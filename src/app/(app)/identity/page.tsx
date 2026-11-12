import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIdentity, removeIdentity, saveIdentityControls } from "@/app/actions/identity";
import { TONE_LABELS, type ToneSetting } from "@/lib/identityTone";
import { LEVELS, QUESTIONS, PATHWAY_CONTEXT, FIRST_EXAMPLE, NO_RANK_NOTE, PICKS_STATUS, STATEMENT_STARTERS, SITUATION_PICKS, BEHAVIOR_PICKS, type IdentityLevel } from "@/content/identity";
import type { PathwayKey } from "@/content/program";
import { fmt } from "@/lib/dates";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { Picks } from "@/components/Picks";
import { IdentitySpectrum } from "@/components/IdentitySpectrum";

export const metadata = { title: "Identity shift" };

export default async function IdentityPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { saved } = await searchParams;
  const [profile, id, history] = await Promise.all([
    db.profile.findUnique({ where: { userId: u.id } }),
    db.identityProfile.findUnique({ where: { userId: u.id } }),
    db.identityHistory.findMany({ where: { userId: u.id }, orderBy: { endedAt: "desc" }, take: 10 }),
  ]);
  const pathway = (profile?.pathway ?? "PERSONAL") as PathwayKey;
  const claimText = (id?.becoming ?? "").replace(/^(i am|i'm)\s+/i, "");

  return (
    <>
      <PageHeader eyebrow="Identity shift · optional" title="Who I am">Claim who you are, and choose how big a change it is. Your FORGE scores and plan stay as they are.</PageHeader>

      {saved && <p role="status" className="mb-4 rounded-xl border border-sage/40 bg-sage-soft px-4 py-2.5 text-sm text-sage">Saved. Next, <Link href="/plan" className="underline">write your FORGE identity</Link> so the rest of your plan builds on who you are.</p>}

      <Card>
        <form action={saveIdentity} className="space-y-6">
          <div>
            <label htmlFor="claim" className="label">1. {QUESTIONS.becoming} <span className="font-normal text-ink-mute">Say it out loud.</span></label>
            <div className="flex items-start rounded-xl border border-line bg-white focus-within:ring-2 focus-within:ring-navy/30 focus-within:border-navy">
              <span className="pl-3.5 pr-1.5 py-2.5 font-serif text-[17px] leading-6 text-navy-deep select-none">I am</span>
              <textarea id="claim" name="claim" required rows={Math.min(6, Math.max(2, Math.ceil(claimText.length / 34)))} maxLength={1500} defaultValue={claimText} placeholder="a leader who operates with integrity" className="flex-1 min-w-0 resize-none bg-transparent py-2.5 pr-3 text-[15px] leading-6 focus:outline-none" />
            </div>
            <Picks list={{ status: PICKS_STATUS, options: STATEMENT_STARTERS[pathway] }} target="claim" folded="Examples" />
          </div>
          <div>
            <Field label={`2. ${QUESTIONS.situation}`}>
              <input name="situation" defaultValue={id?.situation} maxLength={1500} className="input" />
            </Field>
            <Picks list={{ status: PICKS_STATUS, options: SITUATION_PICKS[pathway] }} target="situation" folded="Examples" />
          </div>
          <div>
            <Field label={`3. ${QUESTIONS.behavior}`}>
              <input name="behavior" defaultValue={id?.behavior} maxLength={1500} className="input" />
            </Field>
            <Picks list={{ status: PICKS_STATUS, options: BEHAVIOR_PICKS[pathway] }} target="behavior" folded="Examples" note="Something another person could see you do." />
          </div>

          <fieldset>
            <legend className="label">4. {QUESTIONS.level}</legend>
            <IdentitySpectrum
              initial={id?.level as IdentityLevel | undefined}
              firstExample={FIRST_EXAMPLE[pathway]}
              persona={{ personaName: id?.personaName, personaQualities: id?.personaQualities, personaStandards: id?.personaStandards, personaSituations: id?.personaSituations, personaCue: id?.personaCue, personaBehaviors: id?.personaBehaviors }}
            />
            <p className="mt-4 text-sm text-ink-soft">No level ranks above another. You choose, and you can change it later.</p>
            <details className="mt-1 text-xs text-ink-mute">
              <summary className="cursor-pointer text-navy text-sm">More about the levels</summary>
              <p className="mt-1">{PATHWAY_CONTEXT[pathway]}</p>
              <p className="mt-1">{NO_RANK_NOTE} The app never picks a level from your FORGE scores, and you can change it later without losing anything.</p>
            </details>
          </fieldset>

          <Submit>{id ? "Save changes" : "Save my identity shift"}</Submit>
        </form>
      </Card>

      {id && (
        <details className="card mt-6">
          <summary className="cursor-pointer h3">AI companion and sharing</summary>
          <form action={saveIdentityControls} className="mt-4 space-y-5">
            <fieldset>
              <legend className="label">Coaching tone in the AI companion</legend>
                            <div className="space-y-1.5">
                {(Object.entries(TONE_LABELS) as [ToneSetting, string][]).map(([v, label]) => (
                  <label key={v} className="flex items-start gap-2 text-[15px]">
                    <input type="radio" name="tone" value={v} defaultChecked={id.tone === v} className="mt-1 accent-navy" />
                    <span>{label}{v === "AUTO" && <span className="block text-ink-mute text-sm">Right now: {TONE_LABELS[({ CORE: "SUPPORTIVE", ROLE: "DIRECT", REINVENT: "DEMANDING" } as const)[id.level as IdentityLevel]].toLowerCase()}</span>}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="label">What the AI companion can use</legend>
              <label className="flex items-start gap-2 text-[15px]">
                <input type="checkbox" name="aiUse" defaultChecked={id.aiUse} className="mt-1 h-4 w-4 accent-navy" />
                <span>Use my level, my statement and my behavior. <span className="text-ink-mute text-sm">They are sent to Anthropic, the AI provider, when you chat.</span></span>
              </label>
              {id.level === "REINVENT" && (
                <label className="flex items-start gap-2 text-[15px]">
                  <input type="checkbox" name="aiUsePersona" defaultChecked={id.aiUsePersona} className="mt-1 h-4 w-4 accent-navy" />
                  <span>Also use my performance identity: its name, standards and activation cue.</span>
                </label>
              )}
            </fieldset>
            <fieldset>
              <legend className="label">What my coach can see</legend>
              <p className="text-sm text-ink-soft">Only if you turn on <Link href="/sharing" className="btn-link">Identity shift in Sharing</Link>. Check-in notes stay private.</p>
              {id.level === "REINVENT" && (
                <label className="mt-2 flex items-start gap-2 text-[15px]">
                  <input type="checkbox" name="sharePersona" defaultChecked={id.sharePersona} className="mt-1 h-4 w-4 accent-navy" />
                  <span>When identity shift is shared, include my performance identity too.</span>
                </label>
              )}
            </fieldset>
            <Submit className="btn-quiet">Save these settings</Submit>
          </form>
        </details>
      )}

      {history.length > 0 && (
        <Card className="mt-6">
          <p className="eyebrow">Earlier versions</p>
          <ul className="mt-2 divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="py-2.5">
                <p className="text-xs text-ink-mute">{fmt(h.startedAt, { month: "short", day: "numeric", year: "numeric" })} to {fmt(h.endedAt, { month: "short", day: "numeric", year: "numeric" })} · {LEVELS[h.level as IdentityLevel]?.name}{h.personaName ? ` · ${h.personaName}` : ""}</p>
                <p className="text-[15px]">{h.becoming}</p>
                {h.behavior && <p className="text-sm text-ink-soft">Behavior: {h.behavior}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {id && (
        <form action={removeIdentity} className="mt-6">
          <button className="text-sm text-ink-mute hover:text-ink">Turn off identity shift (your version is kept)</button>
        </form>
      )}
    </>
  );
}
