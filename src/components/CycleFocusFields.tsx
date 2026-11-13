"use client";
import { useState } from "react";
import type { PillarKey } from "@/content/types";
import { CYCLE_FOCUS } from "@/content/options";
import { PillarMark } from "./ui";
import { Picks } from "./Picks";

/** Pillar choice plus pillar-specific starter behaviors for the 30-day cycle. */
export function CycleFocusFields({ pillars, initial, initialFocus = "", identityBehavior = "" }: { pillars: { key: PillarKey; name: string }[]; initial: PillarKey; initialFocus?: string; identityBehavior?: string }) {
  const [pillar, setPillar] = useState<PillarKey>(initial);
  return (
    <>
      <fieldset>
        <legend className="label">Pillar</legend>
        <div className="grid grid-cols-5 gap-2">
          {pillars.map((p) => (
            <label key={p.key} className="cursor-pointer">
              <input type="radio" name="pillar" value={p.key} checked={pillar === p.key} onChange={() => setPillar(p.key)} className="peer sr-only" />
              <span className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface py-3 peer-checked:border-navy peer-checked:ring-2 peer-checked:ring-navy/20 peer-focus-visible:ring-2">
                <PillarMark k={p.key} size="sm" /><span className="text-[11px] text-center leading-tight px-1">{p.name}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="block">
          <span className="label">The behavior you will practice</span>
          <input name="focus" className="input" maxLength={500} defaultValue={initialFocus} placeholder="The situation and what you do in it" />
        </label>
        {identityBehavior && <Picks list={{ status: "approved", options: [identityBehavior] }} target="focus" label="From my road" />}
        <Picks key={pillar} list={CYCLE_FOCUS[pillar]} target="focus" label="Ideas for this pillar" />
      </div>
    </>
  );
}
