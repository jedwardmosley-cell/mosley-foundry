"use client";
import { useState } from "react";
import { LEVELS, IDENTITY_LEVELS, PERSONA_FIELDS, PERSONA_NOTE, PICKS_STATUS, QUALITY_PICKS, PERSONA_SITUATION_PICKS, CUE_PICKS, STANDARD_PICKS, type IdentityLevel } from "@/content/identity";
import { Picks, TagChoices } from "./Picks";

const label = (k: (typeof PERSONA_FIELDS)[number]["key"]) => PERSONA_FIELDS.find((f) => f.key === k)!.label;
const split = (v?: string) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const others = (v: string | undefined, picks: string[]) => split(v).filter((x) => !picks.includes(x)).join(", ");

type Persona = Partial<Record<(typeof PERSONA_FIELDS)[number]["key"], string>>;

/**
 * The three-position spectrum. It is the level question in the form: tap a position to read
 * about it, and the one left selected is the choice. Level 3 opens the optional performance identity.
 */
export function IdentitySpectrum({ initial, firstExample, persona }: { initial?: IdentityLevel; firstExample: Partial<Record<IdentityLevel, number>>; persona: Persona }) {
  const [level, setLevel] = useState<IdentityLevel | undefined>(initial);
  const l = level ? LEVELS[level] : null;
  const examples = l && level ? [...l.examples.slice(firstExample[level] ?? 0), ...l.examples.slice(0, firstExample[level] ?? 0)] : [];
  return (
    <div>
      <div className="relative pt-2">
        <div aria-hidden className="absolute left-[16.6%] right-[16.6%] top-[22px] h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${LEVELS.CORE.color}, ${LEVELS.ROLE.color}, ${LEVELS.REINVENT.color})` }} />
        <div role="radiogroup" aria-label="Identity Shift Spectrum" className="relative grid grid-cols-3">
          {IDENTITY_LEVELS.map((k) => {
            const x = LEVELS[k];
            const on = level === k;
            return (
              <label key={k} className="flex flex-col items-center text-center cursor-pointer px-1">
                <input type="radio" name="level" value={k} checked={on} onChange={() => setLevel(k)} required className="peer sr-only" />
                <span className="h-9 w-9 rounded-full border-4 border-card flex items-center justify-center font-serif text-white text-sm shadow-sm transition-transform peer-focus-visible:ring-2 peer-focus-visible:ring-navy/50"
                  style={{ background: x.color, transform: on ? "scale(1.3)" : "scale(1)", boxShadow: on ? `0 0 0 3px ${x.color}33` : undefined }}>{x.n}</span>
                <span className={`mt-2 text-[13px] leading-tight ${on ? "font-semibold text-navy-deep" : "text-ink-soft"}`}>{x.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      {!l && <p className="mt-4 text-sm muted text-center">Tap a position to see what it means. You can look at all three before you choose.</p>}

      {l && level && (
        <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: l.color }} aria-live="polite">
          <p className="font-serif text-xl text-navy-deep">{l.line}</p>
          <p className="mt-1 text-[15px] text-ink-soft">{l.forWhom}</p>
          <p className="mt-3 text-xs uppercase tracking-wider text-ink-mute">For example</p>
          <ul className="mt-1 space-y-0.5 text-[15px]">{examples.map((e) => <li key={e}>{e}</li>)}</ul>
          <p className="mt-3 text-xs uppercase tracking-wider text-ink-mute">How the coaching feels</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{l.coaching.map((c) => <span key={c} className="chip">{c}</span>)}</div>
          <p className="mt-3 text-sm"><span className="text-ink-mute">The work centers on: </span>{l.emphasis}</p>
        </div>
      )}

      <div className={level === "REINVENT" ? "mt-5" : "hidden"}>
        <details className="rounded-2xl border border-line bg-white p-4" open={!!persona.personaName}>
          <summary className="cursor-pointer font-medium">Create a performance identity <span className="text-ink-mute font-normal">(optional)</span></summary>
          <p className="mt-2 text-sm text-ink-soft">{PERSONA_NOTE}</p>
          <div className="mt-3 space-y-4">
            <label className="block"><span className="label">{label("personaName")}</span><input name="personaName" defaultValue={persona.personaName} maxLength={120} className="input" placeholder="A name you will say to yourself" /></label>
            <div>
              <TagChoices name="qualityPick" list={{ status: PICKS_STATUS, options: QUALITY_PICKS }} legend={label("personaQualities")} selected={split(persona.personaQualities)} />
              <input name="personaQualities" defaultValue={others(persona.personaQualities, QUALITY_PICKS)} maxLength={600} className="input mt-2" placeholder="Other qualities, separated by commas" aria-label="Other qualities" />
            </div>
            <div>
              <label className="block"><span className="label">{label("personaStandards")}</span>
                <textarea name="personaStandards" defaultValue={persona.personaStandards} maxLength={1500} className="textarea !min-h-[64px]" placeholder="Write each one as an I statement" />
              </label>
              <Picks list={{ status: PICKS_STATUS, options: STANDARD_PICKS }} target="personaStandards" label="Tap one to start, then add your own" />
            </div>
            <div>
              <TagChoices name="situationPick" list={{ status: PICKS_STATUS, options: PERSONA_SITUATION_PICKS }} legend={label("personaSituations")} selected={split(persona.personaSituations)} />
              <input name="personaSituations" defaultValue={others(persona.personaSituations, PERSONA_SITUATION_PICKS)} maxLength={600} className="input mt-2" placeholder="Other situations, separated by commas" aria-label="Other situations" />
            </div>
            <div>
              <label className="block"><span className="label">{label("personaCue")}</span><input name="personaCue" defaultValue={persona.personaCue} maxLength={600} className="input" /></label>
              <Picks list={{ status: PICKS_STATUS, options: CUE_PICKS }} target="personaCue" />
            </div>
            <details open={!!persona.personaBehaviors}>
              <summary className="cursor-pointer text-sm text-navy">{label("personaBehaviors")} <span className="text-ink-mute">(optional)</span></summary>
              <textarea name="personaBehaviors" aria-label={label("personaBehaviors")} defaultValue={persona.personaBehaviors} maxLength={1500} className="textarea !min-h-[64px] mt-2" />
            </details>
          </div>
        </details>
      </div>
    </div>
  );
}
