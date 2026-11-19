import { Submit } from "./Submit";
import { runCoachDraft, cancelCoachDraft } from "@/app/actions/coach";
import type { getDraft } from "@/lib/coachAssistant";

type Draft = NonNullable<Awaited<ReturnType<typeof getDraft>>>;

/** The assistant's plan, laid out for the coach to tick, edit and approve. Nothing happens until Do these. */
export function AssistantDraft({ draft, back }: { draft: Draft; back?: string }) {
  return (
    <form className="mt-4 space-y-3">
      <input type="hidden" name="draftId" value={draft.id} />
      {back && <input type="hidden" name="back" value={back} />}
      <p className="text-sm text-ink-mute">You asked: &ldquo;{draft.instruction}&rdquo;</p>
      {draft.plan.actions.length === 0 && <p className="text-[15px]">There&apos;s nothing here to do yet.</p>}
      {draft.plan.actions.length > 0 && <p className="section-label">Here&apos;s what I&apos;ll do. Untick anything you don&apos;t want, and fix any date.</p>}
      <ul className="space-y-2">
        {draft.plan.actions.map((a, i) => (
          <li key={i} className="rounded-2xl bg-ink/[0.04] p-3">
            <label className="flex items-start gap-3">
              <input type="checkbox" name={`do_${i}`} defaultChecked className="mt-1 h-4 w-4 accent-navy" />
              <span className="text-[15px]">
                {a.type === "assign_exercise"
                  ? <>Assign <span className="font-bold text-heading">{a.clientName}</span> {a.exerciseRef === "custom" ? "a custom exercise" : <>the exercise <span className="font-medium text-heading">{a.exerciseTitle}</span></>}</>
                  : <>Book a session with <span className="font-bold text-heading">{a.clientName}</span>{a.agenda ? <>: {a.agenda}</> : null}</>}
              </span>
            </label>
            <div className="mt-2 ml-7 grid gap-2 sm:grid-cols-2">
              {a.type === "assign_exercise" && a.exerciseRef === "custom" && (
                <label className="sm:col-span-2 text-xs text-ink-mute">Title<input name={`title_${i}`} defaultValue={a.title} maxLength={200} className="input mt-1" /></label>
              )}
              {a.type === "assign_exercise" && a.exerciseRef === "custom" && a.instructions && <p className="sm:col-span-2 text-sm text-ink-soft whitespace-pre-line">{a.instructions}</p>}
              {a.type === "assign_exercise" && <label className="text-xs text-ink-mute">Due<input type="date" name={`due_${i}`} defaultValue={a.dueOn} className="input mt-1" /></label>}
              {a.type === "schedule_session" && <label className="text-xs text-ink-mute">When<input type="datetime-local" name={`when_${i}`} defaultValue={a.when} className="input mt-1 min-w-0 max-w-full" /></label>}
            </div>
          </li>
        ))}
      </ul>
      {draft.plan.unclear.length > 0 && (
        <div className="border-l-4 border-lane pl-4">
          <p className="text-sm font-bold text-heading">Check these</p>
          <ul className="mt-1 list-disc pl-5 text-[15px] space-y-0.5">{draft.plan.unclear.map((u) => <li key={u}>{u}</li>)}</ul>
        </div>
      )}
      <div className="flex flex-wrap gap-3 pt-1">
        {draft.plan.actions.length > 0 && <Submit formAction={runCoachDraft} className="btn-primary">Do these</Submit>}
        <Submit formAction={cancelCoachDraft} className="btn-quiet">{draft.plan.actions.length ? "Cancel" : "Start over"}</Submit>
      </div>
    </form>
  );
}
