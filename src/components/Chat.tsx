"use client";
import { useActionState, useEffect, useRef } from "react";
import { sendMessage, type ChatState } from "@/app/actions/ai";
import { RichText } from "./RichText";

type Msg = { id: string; role: string; content: string; citations: { id: string; ref: string }[] };

export function Chat({ id, messages, starter }: { id: string; messages: Msg[]; starter: string }) {
  const [state, action, pending] = useActionState<ChatState, FormData>(sendMessage, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pending) formRef.current?.reset();
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pending, messages.length]);
  return (
    <div>
      <div className="space-y-4" aria-live="polite">
        {messages.length === 0 && <div className="rounded-2xl bg-card border border-line p-4 font-serif text-lg">{starter}</div>}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl bg-navy text-white px-4 py-3" : "rounded-2xl bg-card border border-line px-4 py-3"}>
              {m.role === "assistant" ? <RichText text={m.content} /> : <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.content}</p>}
              {m.citations.length > 0 && (
                <ul className="mt-3 border-t border-line pt-2 space-y-0.5">
                  {m.citations.map((c) => <li key={c.id} className="text-xs text-ink-mute">[{c.id}] {c.ref}</li>)}
                </ul>
              )}
            </div>
          </div>
        ))}
        {pending && <p className="text-sm muted">Thinking it through...</p>}
        <div ref={endRef} />
      </div>
      {/* Sits directly on the mobile tab bar; the solid shadow fills the gap below so text never shows through. */}
      <form ref={formRef} action={action} className="mt-6 sticky bottom-[72px] md:bottom-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-3 bg-paper border-t border-line shadow-[0_96px_0_0_#F6F2EA]">
        <input type="hidden" name="id" value={id} />
        <label className="sr-only" htmlFor="msg">Message</label>
        <div className="flex gap-2 items-end">
          <textarea id="msg" name="content" required maxLength={6000} rows={2} className="textarea !min-h-[52px]" placeholder="Answer with the exit closed."
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); formRef.current?.requestSubmit(); } }} />
          <button className="btn-primary shrink-0" disabled={pending}>Send</button>
        </div>
        {state?.error && <p role="alert" className="mt-2 text-sm text-clay">{state.error}</p>}
      </form>
    </div>
  );
}
