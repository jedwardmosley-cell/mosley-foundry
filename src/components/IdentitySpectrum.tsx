"use client";
import { useState } from "react";
import { LEVELS, IDENTITY_LEVELS, PERSONA_FIELDS, PERSONA_NOTE, PICKS_STATUS, QUALITY_PICKS, PERSONA_SITUATION_PICKS, CUE_PICKS, STANDARD_PICKS, type IdentityLevel } from "@/content/identity";
import { Picks, TagChoices } from "./Picks";
import { KIND_NOTE } from "@/content/whoIAm";

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
      {/* Three equal choices. No numbers, no line, no pillar colors. */}
      <div role="radiogroup" aria-label="The kind of change" className="grid gap-2 sm:grid-cols-3">
        {IDENTITY_LEVELS.map((k) => {
          const x = LEVELS[k];
          return (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="level" value={k} checked={level === k} onChange={() => setLevel(k)} required className="peer sr-only" />
              <span className="option h-full">
                <span className="block font-medium text-[15px]">{x.name}</span>
                <span className="mt-1 block text-sm text-ink-soft">{x.line}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-ink-soft">{KIND_NOTE}</p>
      {l && level && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-link">More about {l.name}</summary>
          <p className="mt-2 text-ink-soft">{l.forWhom}</p>
          <p className="mt-2 text-xs uppercase tracking-wider text-ink-mute">For example</p>
          <ul className="mt-1 space-y-0.5">{examples.map((e) => <li key={e}>{e}</li>)}</ul>
          <p className="mt-2"><span className="text-ink-mute">The work centers on: </span>{l.emphasis}</p>
        </details>
      )}

      <div className={level === "REINVENT" ? "mt-5" : "hidden"}>
        <details className="rounded-2xl bg-field p-4" open={!!persona.personaName}>
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
              <Picks list={{ status: PICKS_STATUS, options: STANDARD_PICKS }} target="personaStandards" folded="Examples" />
            </div>
            <div>
              <TagChoices name="situationPick" list={{ status: PICKS_STATUS, options: PERSONA_SITUATION_PICKS }} legend={label("personaSituations")} selected={split(persona.personaSituations)} />
              <input name="personaSituations" defaultValue={others(persona.personaSituations, PERSONA_SITUATION_PICKS)} maxLength={600} className="input mt-2" placeholder="Other situations, separated by commas" aria-label="Other situations" />
            </div>
            <div>
              <label className="block"><span className="label">{label("personaCue")}</span><input name="personaCue" defaultValue={persona.personaCue} maxLength={600} className="input" /></label>
              <Picks list={{ status: PICKS_STATUS, options: CUE_PICKS }} target="personaCue" folded="Examples" />
            </div>
            <details open={!!persona.personaBehaviors}>
              <summary className="cursor-pointer text-sm text-link">{label("personaBehaviors")} <span className="text-ink-mute">(optional)</span></summary>
              <textarea name="personaBehaviors" aria-label={label("personaBehaviors")} defaultValue={persona.personaBehaviors} maxLength={1500} className="textarea !min-h-[64px] mt-2" />
            </details>
          </div>
        </details>
      </div>
    </div>
  );
}
