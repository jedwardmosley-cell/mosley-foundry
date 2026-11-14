"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus, createPortal } from "react-dom";
import { FORGE_LINES, withPrefix, combineLines } from "@/content/forgeLines";

/**
 * The signature moment: before Who I am is saved, the client's full statement fills the screen,
 * set large in the serif, with one line under it. Save happens from there.
 * If the statement box is empty, it starts from the five lines (on screen, or saved).
 */
export function StatementReveal({ label = "Save who I am", saved = {} }: { label?: string; saved?: Partial<Record<string, string>> }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const { pending } = useFormStatus();

  const form = () => ref.current?.closest("form") ?? null;
  const open = () => {
    const f = form();
    if (!f) return;
    setMissing(null);
    // Say what is missing instead of failing quietly: the seat, and how big a turn, are needed to save.
    const kind = f.querySelector('input[name="level"]');
    const role = f.querySelector<HTMLInputElement>('input[name="role"]');
    const need = [
      role && !role.value.trim() ? { msg: "Name the seat you're in (step 1).", el: role as Element } : null,
      kind && !f.querySelector('input[name="level"]:checked') ? { msg: "Choose how big a turn this is (step 2).", el: kind.closest('[role="radiogroup"]') ?? kind } : null,
    ].filter(Boolean) as { msg: string; el: Element }[];
    if (need.length) {
      setMissing(need.map((n) => n.msg).join(" "));
      need[0].el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const box = f.querySelector<HTMLTextAreaElement>('[name="statement"]');
    let s = box?.value.trim() ?? "";
    if (!s) {
      const val = (n: string) => f.querySelector<HTMLTextAreaElement>(`[name="${n}"]`);
      const lines = Object.fromEntries(FORGE_LINES.map((l) => {
        const el = val(l.field);
        if (!el) return [l.field, saved[l.field] ?? ""];
        return [l.field, f.querySelector(`[name="${l.field}__p"]`) ? withPrefix(l.prefix, el.value) : el.value.trim()];
      }));
      s = combineLines(lines);
      if (box && s) box.value = s;
    }
    if (!s) return f.requestSubmit();
    setText(s);
  };

  useEffect(() => {
    if (text === null) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setText(null);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [text]);

  return (
    <span ref={ref}>
      <button type="button" onClick={open} className="btn-primary">{label}</button>
      {missing && <span role="alert" className="mt-2 block text-sm text-alert">{missing}</span>}
      {/* Rendered at the top of the page, so nothing on the screen behind it shows through. */}
      {text !== null && createPortal(
        <div role="dialog" aria-modal="true" aria-labelledby="reveal-line" className="reveal fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-paper px-6 sm:px-10">
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-10">
            <p className="font-serif text-[28px] sm:text-[36px] leading-[1.3] tracking-[-0.01em] text-heading">{text}</p>
            <p id="reveal-line" className="mt-8 text-[17px] text-ink-soft">This is who&apos;s behind the wheel.</p>
          </div>
          <div className="mx-auto flex w-full max-w-2xl items-center gap-5 pb-10">
            <button type="button" disabled={pending} onClick={() => form()?.requestSubmit()} className="btn-primary min-w-[140px]">{pending ? "Saving..." : "Save"}</button>
            <button type="button" onClick={() => setText(null)} className="btn-link text-[15px]">Edit</button>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
