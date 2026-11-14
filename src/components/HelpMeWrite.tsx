"use client";
import { useRef, useState, useTransition } from "react";
import { draftWithAI, type DraftKind } from "@/app/actions/ai";

/** Asks the AI companion for a first draft from the participant's own records. Never saves on its own. */
export function HelpMeWrite({ kind, target, strip = "" }: { kind: DraftKind; target: string; strip?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = () =>
    start(async () => {
      setError(null);
      const r = await draftWithAI(kind);
      if ("error" in r) return setError(r.error);
      const el = ref.current?.closest("form")?.querySelector<HTMLTextAreaElement>(`[name="${target}"]`);
      if (el) {
        // When the box already shows a fixed start ("I am", "I notice"), drop it from the draft.
        el.value = strip && r.text.toLowerCase().startsWith(strip.toLowerCase() + " ") ? r.text.slice(strip.length + 1) : r.text;
        el.focus();
      }
    });
  return (
    <span ref={ref} className="inline-flex flex-col">
      <button type="button" onClick={run} disabled={pending} className="text-sm btn-link text-left">
        <span aria-hidden className="mr-1">✦</span>{pending ? "Writing..." : "Help me with this"}
      </button>
      {error && <span role="alert" className="text-xs text-alert mt-1">{error}</span>}
      {!error && <span className="text-[11px] text-ink-mute">A starting point from what you have recorded. Edit it until it is true, then save.</span>}
    </span>
  );
}
