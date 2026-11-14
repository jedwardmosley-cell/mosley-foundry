"use client";
import { useState } from "react";
import type { PillarKey } from "@/content/types";
import { PillarMark } from "./ui";

/** Pillar choice for the 30-day cycle. The behavior itself comes from week 1 setup. */
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
              <span className="option !flex flex-col items-center gap-1 !px-0 !py-3">
                <PillarMark k={p.key} size="sm" /><span className="text-[11px] text-center leading-tight px-1">{p.name}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {/* The behavior now comes from week 1 setup. One carried in (from EQ-i, My road or last month) starts the new response. */}
      <input type="hidden" name="focus" value={initialFocus || identityBehavior} />
      <p className="text-sm text-ink-soft">
        Next, five short questions name the moment you want to change and what you&apos;ll do instead.
        {(initialFocus || identityBehavior) && <> You&apos;ll start from: <span className="text-ink">{initialFocus || identityBehavior}</span></>}
      </p>
    </>
  );
}
