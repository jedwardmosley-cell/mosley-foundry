"use client";
import { useRef } from "react";
import type { OptionList } from "@/content/options";

/**
 * Tap-to-fill suggestions for a text field in the same form.
 * The field stays editable; without JavaScript the chips simply do nothing.
 */
export function Picks({ list, target, label = "Tap to use one, then edit if you like", folded, note, groups, alignRight = false }: { list: OptionList; target: string; label?: string; folded?: string; note?: string; groups?: { label: string; options: string[] }[]; alignRight?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const fill = (text: string) => {
    const form = ref.current?.closest("form");
    const el = form?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${target}"]`);
    if (!el) return;
    el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
  };
  if (folded) {
    // Folded: one small "Examples" toggle instead of a block of text and buttons.
    return (
      <div ref={ref} className="mt-1.5">
        <details>
          <summary className={`cursor-pointer text-sm text-link ${alignRight ? "text-right" : ""}`}>{folded}{list.status === "draft" && <span className="ml-2 draft !text-[10px]">Draft</span>}</summary>
          {note && <p className="mt-2 text-xs text-ink-mute">{note}</p>}
          {groups && groups.map((g) => (
            <div key={g.label} className="mt-2.5">
              <p className="text-[11px] uppercase tracking-[0.1em] text-ink-mute">{g.label}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {g.options.map((o) => (
                  <button key={o} type="button" onClick={() => fill(o)}
                    className="pick">
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap gap-2">
            {list.options.map((o) => (
              <button key={o} type="button" onClick={() => fill(o)}
                className="pick">
                {o}
              </button>
            ))}
          </div>
        </details>
      </div>
    );
  }
  return (
    <div ref={ref} className="mt-2">
      <p className="text-xs text-ink-mute mb-1.5">
        {label}
        {list.status === "draft" && <span className="ml-2 draft !text-[10px]">Draft options</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {list.options.map((o) => (
          <button key={o} type="button" onClick={() => fill(o)}
            className="pick">
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Multi-select chips posted as repeated form values (works without JavaScript). */
export function TagChoices({ name, list, selected = [], legend }: { name: string; list: OptionList; selected?: string[]; legend: string }) {
  return (
    <fieldset>
      <legend className="label">
        {legend} <span className="text-ink-mute font-normal">(optional)</span>
        {list.status === "draft" && <span className="ml-2 draft !text-[10px]">Draft options</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {list.options.map((o) => (
          <label key={o} className="cursor-pointer">
            <input type="checkbox" name={name} value={o} defaultChecked={selected.includes(o)} className="peer sr-only" />
            <span className="pick block peer-checked:bg-navy peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-navy/20">
              {o}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function DictationHint() {
  return <p className="mt-1 text-xs text-ink-mute">Tip: tap the microphone on your keyboard to speak instead of typing.</p>;
}
