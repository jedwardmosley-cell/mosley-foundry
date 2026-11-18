"use client";
import { useState } from "react";
import type { PillarKey } from "@/content/types";
import { CYCLE_FOCUS } from "@/content/options";
import { PillarMark } from "./ui";
import { Picks } from "./Picks";

/**
 * Choosing a focus: first the rule it builds, then the focus in a few words.
 * The ideas follow the rule that is picked, so any rule can be chosen. The behavior itself comes from the setup questions.
 */
export function CycleFocusFields({ pillars, initial, initialTitle = "", initialFocus = "", identityBehavior = "" }: { pillars: { key: PillarKey; name: string }[]; initial: PillarKey; initialTitle?: string; initialFocus?: string; identityBehavior?: string }) {
  const [pillar, setPillar] = useState<PillarKey>(initial);
  const name = pillars.find((p) => p.key === pillar)?.name ?? "";
  return (
    <>
      <fieldset>
        <legend className="label">Which rule does this build?</legend>
        <div className="grid grid-cols-5 gap-2">
          {pillars.map((p) => (
            <label key={p.key} className="cursor-pointer">
              <input type="radio" name="pillar" value={p.key} checked={pillar === p.key} onChange={() => setPillar(p.key)} className="peer sr-only" />
              <span className="option !flex flex-col items-center gap-1 !px-0 !py-3">
                <PillarMark k={p.key} size="sm" /><span className="text-[11px] text-center leading-tight px-1">{p.name}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-mute">Any rule works. The goal is a 5 on every one.</p>
      </fieldset>
      <div>
        <label htmlFor="title" className="label">My focus, in a few words</label>
        <input id="title" name="title" required maxLength={160} defaultValue={initialTitle} placeholder="Stay curious when my decisions get challenged" className="input" />
        {/* key: a new rule shows its own ideas. */}
        <div className="mt-2" key={pillar}><Picks list={CYCLE_FOCUS[pillar]} target="title" folded={`Ideas for ${name}`} /></div>
      </div>
      {/* The behavior comes from the setup questions. One carried in (from EQ-i, the Vehicle Controls or last month) starts the new response. */}
      <input type="hidden" name="focus" value={initialFocus || identityBehavior} />
      <p className="text-sm text-ink-soft">
        Next, five short questions name the moment you want to change and what you&apos;ll do instead.
        {(initialFocus || identityBehavior) && <> You&apos;ll start from: <span className="text-ink">{initialFocus || identityBehavior}</span></>}
      </p>
    </>
  );
}
