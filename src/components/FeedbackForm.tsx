"use client";
import { useActionState } from "react";
import { saveFeedback, type FeedbackState } from "@/app/actions/feedback";
import { FEEDBACK_SOURCES, FEEDBACK_COPY } from "@/content/feedback";
import { PillarMark } from "./ui";
import type { PillarKey } from "@/content/types";

type Initial = { id?: string; source?: string; title?: string; takenOn?: string; summary?: string; pillars?: string[]; fileName?: string | null };
const KEYS: PillarKey[] = ["F", "O", "R", "G", "E"];

/** Add or edit a My feedback entry: where it came from, the client's own summary, a file of their notes, and the pillars. */
export function FeedbackForm({ initial = {}, pillarNames }: { initial?: Initial; pillarNames: Record<string, string> }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(saveFeedback, undefined);
  return (
    <form action={action} className="space-y-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <fieldset>
        <legend className="label">Where it came from</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(FEEDBACK_SOURCES).map(([k, l], i) => (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="source" value={k} defaultChecked={initial.source ? initial.source === k : i === 0} className="peer sr-only" />
              <span className="pick block peer-checked:bg-surface peer-checked:text-heading peer-checked:shadow-[0_0_0_2px_rgb(var(--navy)/0.45)]">{l}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <label className="block"><span className="label">Title <span className="font-normal text-ink-mute">(optional)</span></span><input name="title" defaultValue={initial.title} maxLength={160} placeholder="For example: CCL Benchmarks 360" className="input" /></label>
        <label className="block"><span className="label">When</span><input type="month" name="takenOn" defaultValue={initial.takenOn} className="input" /></label>
      </div>
      <label className="block">
        <span className="label">My summary</span>
        <span className="mb-2 block text-sm text-ink-soft">{FEEDBACK_COPY.notFullReport}</span>
        <textarea name="summary" defaultValue={initial.summary} maxLength={8000} className="textarea !min-h-[140px] font-serif !text-[17px]" placeholder="What the feedback said, in your words, and what you took from it." />
      </label>
      <label className="block">
        <span className="label">A file of my own notes <span className="font-normal text-ink-mute">(optional)</span></span>
        {initial.fileName && <span className="mb-2 block text-sm text-ink-soft">Now attached: {initial.fileName}. Choose a new file to replace it.</span>}
        <input type="file" name="file" accept="application/pdf,.pdf,.doc,.docx,image/*" className="block w-full rounded-2xl border border-dashed border-ink/20 bg-surface/60 px-4 py-4 text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-ink/[0.06] file:px-3 file:py-1.5 file:text-sm file:text-heading" />
        <span className="mt-1 block text-xs text-ink-mute">{FEEDBACK_COPY.fileHint}</span>
      </label>
      <fieldset>
        <legend className="label">{FEEDBACK_COPY.pillarsQuestion} <span className="font-normal text-ink-mute">(optional)</span></legend>
        <div className="flex flex-wrap gap-2">
          {KEYS.map((k) => (
            <label key={k} className="cursor-pointer">
              <input type="checkbox" name="pillars" value={k} defaultChecked={initial.pillars?.includes(k)} className="peer sr-only" />
              <span className="option !flex items-center gap-2 !px-3 !py-2 text-sm"><PillarMark k={k} size="sm" />{pillarNames[k]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" name="ownSummary" required className="mt-1 h-4 w-4 accent-navy" />
        <span>{FEEDBACK_COPY.ownSummary}</span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-alert">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save"}</button>
    </form>
  );
}
