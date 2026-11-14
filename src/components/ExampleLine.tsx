"use client";
import { useRef } from "react";

/** The one example shown under a question. Tapping it puts it in the box to edit. */
export function ExampleLine({ target, text }: { target: string; text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const fill = () => {
    const el = ref.current?.closest("form")?.querySelector<HTMLTextAreaElement>(`[name="${target}"]`);
    if (!el) return;
    el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
  };
  return (
    <p ref={ref} className="mt-2 text-sm text-ink-soft">
      For example:{" "}
      <button type="button" onClick={fill} title="Use this as a starting point" className="text-left font-serif text-[15px] text-heading underline decoration-gold/50 underline-offset-4 hover:decoration-gold">I am {text}</button>
    </p>
  );
}
