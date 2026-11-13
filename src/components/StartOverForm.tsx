"use client";
import { useActionState } from "react";
import { startOver, type StartOverState } from "@/app/actions/participant";

/** Start over: erases the client's own records. Needs the words typed, because it cannot be undone. */
export function StartOverForm() {
  const [s, action, pending] = useActionState<StartOverState, FormData>(startOver, undefined);
  return (
    <details className="rounded-2xl border border-clay/40 bg-card p-5">
      <summary className="cursor-pointer h3 !text-clay">Start over</summary>
      <p className="mt-3 text-[15px]">This erases everything you have entered and takes you back to the beginning: your identity and FORGE statements, scores, blueprint, people, 30-day cycles, seasons, check-ins, reflections, journal and AI conversations.</p>
      <p className="mt-2 text-sm text-ink-soft">Your login, settings and coach stay. What you chose to share stays switched on, but there will be nothing in it until you start again. This cannot be undone. To keep a copy first, open History and download your development summary.</p>
      <form action={action} className="mt-4 space-y-3">
        <label className="block">
          <span className="label">Type &quot;start over&quot; to confirm</span>
          <input name="confirm" autoComplete="off" className="input max-w-[240px]" />
        </label>
        {s?.error && <p role="alert" className="text-sm text-clay">{s.error}</p>}
        <button disabled={pending} className="btn bg-clay text-white hover:bg-clay/90">{pending ? "Erasing..." : "Erase everything and start over"}</button>
      </form>
    </details>
  );
}
