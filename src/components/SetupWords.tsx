"use client";
import { useRef, useState, useTransition } from "react";
import { setupWords } from "@/app/actions/ai";

/** "Help me with this" on a week 1 screen: options to choose from. Tapping one puts it in the box to edit. */
export function SetupWords({ field, note }: { field: string; note?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [options, setOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const box = () => ref.current?.closest("form")?.querySelector<HTMLTextAreaElement>('[name="value"]') ?? null;
  const ask = () => start(async () => {
    setError(null);
    const r = await setupWords(field, box()?.value ?? "");
    if ("error" in r) return setError(r.error);
    setOptions(r.options);
  });
  const use = (o: string) => {
    const el = box();
    if (!el) return;
    el.value = o;
    el.focus();
  };
  return (
    <div ref={ref} className="mt-3">
      <button type="button" onClick={ask} disabled={pending} className="text-sm btn-link"><span aria-hidden className="mr-1">✦</span>{pending ? "Thinking..." : options.length ? "Ask again" : "Help me with this"}</button>
      {note && <p className="mt-1 text-xs text-ink-mute">{note}</p>}
      {error && <p role="alert" className="mt-1 text-sm text-alert">{error}</p>}
      {options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((o) => <button key={o} type="button" onClick={() => use(o)} className="pick">{o}</button>)}
        </div>
      )}
    </div>
  );
}
