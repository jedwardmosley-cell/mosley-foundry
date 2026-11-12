"use client";
import { useRef } from "react";
import { FORGE_LINES, withPrefix, combineLines } from "@/content/forgeLines";

/** Puts the five FORGE identity statements together in the FORGE statement box, as a starting point. No AI needed. */
export function CombineLines({ target }: { target: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const run = () => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const val = (n: string) => (form.querySelector<HTMLTextAreaElement>(`[name="${n}"]`)?.value ?? "");
    const fixed = (n: string) => !!form.querySelector(`[name="${n}__p"]`);
    const lines = Object.fromEntries(FORGE_LINES.map((l) => [l.field, fixed(l.field) ? withPrefix(l.prefix, val(l.field)) : val(l.field).trim()]));
    const el = form.querySelector<HTMLTextAreaElement>(`[name="${target}"]`);
    if (!el) return;
    el.value = combineLines(lines);
    el.focus();
  };
  return (
    <button ref={ref} type="button" onClick={run} className="text-sm btn-link text-left">
      Put my five statements together
    </button>
  );
}
