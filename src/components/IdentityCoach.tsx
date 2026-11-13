"use client";
import { useRef, useState, useTransition } from "react";
import { coachLine } from "@/app/actions/ai";
import type { CoachReply } from "@/lib/ai";

const KIND_LABEL: Record<CoachReply["kind"], string> = {
  goal: "This reads like a goal",
  habit: "This reads like a habit",
  value: "This reads like a value",
  identity: "This reads like an identity",
  empty: "A place to start",
};

/**
 * "Help me with this": the AI works as an identity coach. It reads what the client typed, says whether it is
 * a goal, a habit, a value or an identity, asks one question, and offers a statement they can use or edit.
 */
export function IdentityCoach({ field, prefix = "I am", corner = false }: { field: string; prefix?: string; corner?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [reply, setReply] = useState<CoachReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = () => ref.current?.closest("form")?.querySelector<HTMLTextAreaElement>(`[name="${field}"]`) ?? null;

  const ask = () =>
    start(async () => {
      setError(null);
      const r = await coachLine(field, box()?.value ?? "");
      if ("error" in r) { setReply(null); return setError(r.error); }
      setReply(r);
    });
  const use = () => {
    const el = box();
    if (!el || !reply?.suggestion) return;
    const s = reply.suggestion;
    el.value = s.toLowerCase().startsWith(prefix.toLowerCase() + " ") ? s.slice(prefix.length + 1) : s;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
  };

  return (
    <div ref={ref} className={corner ? "" : "mt-2"}>
      <button type="button" onClick={ask} disabled={pending} className={corner ? "absolute left-0 top-[3px] text-sm text-link hover:text-heading" : "text-sm btn-link text-left"}>
        {corner && <span aria-hidden className="mr-1">✦</span>}{pending ? "Thinking..." : reply ? "Ask again" : "Help me with this"}
      </button>
      {error && <p role="alert" className="text-xs text-alert mt-1">{error}</p>}
      {reply && (
        <div className="mt-2 rounded-xl bg-paper p-3 text-sm" aria-live="polite">
          <p className="font-medium">{KIND_LABEL[reply.kind]}</p>
          {reply.note && <p className="mt-1 text-ink-soft">{reply.note}</p>}
          {reply.question && <p className="mt-2"><span className="text-ink-mute">A question: </span>{reply.question}</p>}
          {reply.suggestion && (
            <div className="mt-2">
              <p className="font-serif text-[15px]">{reply.suggestion}</p>
              <button type="button" onClick={use} className="mt-1 text-sm btn-link">Use this, then edit it</button>
            </div>
          )}
          <p className="mt-2 text-[11px] text-ink-mute">From the AI companion. Keep only what is true for you.</p>
        </div>
      )}
    </div>
  );
}
