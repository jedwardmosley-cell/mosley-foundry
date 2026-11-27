import { FORGE_LINES } from "@/content/forgeLines";
import { positionWord } from "@/lib/distance";
import { withArticle } from "@/content/whoIAm";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCoachView, getCoachWork, ForbiddenError, SHARE_SCOPES, type ShareScope } from "@/lib/access";
import { attentionFlags } from "@/lib/coachSummary";
import { assignExercise, scheduleSession, saveSessionNotes, recordEqiInterpretation, prepareSessionBrief, draftSessionWrapUp, saveSessionWrapUp, discardSessionWrapUp, planCoachActions, updateExercise, deleteExercise, updateSession, deleteSession } from "@/app/actions/coach";
import { CopyText } from "@/components/CopyText";
import { AssistantDraft } from "@/components/AssistantDraft";
import { getDraft } from "@/lib/coachAssistant";
import { latestBrief, getWrapUp } from "@/lib/coachBrief";
import { aiAvailable } from "@/lib/ai";
import { getContent } from "@/content";
import { exerciseMenu } from "@/lib/exercises";
import { cycleWeeks, cyclePosition, practiceSummary } from "@/lib/cycle";
import { scoresFrom } from "@/lib/forge";
import { RELATIONSHIP_ROLES, SEGMENTS, CHECKIN_STATUS, DAY30_DECISIONS } from "@/content/program";
import { fmt } from "@/lib/dates";
import { fmtIn, toWallTime, SESSION_TIME } from "@/lib/zone";
import { zoneOf } from "@/lib/userZone";
import { TimezoneField } from "@/components/Timezone";
import type { PillarKey } from "@/content/types";
import { PILLAR_KEYS } from "@/content/types";
import { PageHeader, Card, PillarMark, Field, PILLAR_FILL } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { removeClient } from "@/app/actions/clients";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { LEVELS, IDENTITY_EXERCISES, type IdentityLevel } from "@/content/identity";

function NotShared({ scope }: { scope: ShareScope }) {
  return <p className="text-sm text-ink-mute">Not shared: {SHARE_SCOPES[scope].toLowerCase()}.</p>;
}

export default async function CoachParticipant({ params, searchParams }: { params: Promise<{ participantId: string }>; searchParams: Promise<{ brief?: string; wrap?: string; wrapnote?: string; wrapped?: string; saved?: string; draft?: string; done?: string; assistant?: string; open?: string }> }) {
  const coach = await requireUser("COACH");
  const { participantId } = await params;
  const sp = await searchParams;
  // Session times are the coach's own.
  const zone = await zoneOf(coach);
  let v, work;
  try {
    v = await getCoachView(coach, participantId);
    work = await getCoachWork(coach, participantId);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  const { pack } = await getContent();
  const s = new Set(v.scopes);
  const flags = attentionFlags(v);
  const pk = v.profile?.priorityPillar as PillarKey | undefined;
  const stripPillar = ((v.cycle?.pillar ?? pk ?? "F") as PillarKey);
  const scores = v.assessment ? scoresFrom(v.assessment) : null;
  const pos = v.cycle ? cyclePosition(v.cycle.startDate) : null;
  const week = v.cycle && pos ? cycleWeeks(v.cycle.template, pack).weeks[pos.week - 1] : null;
  const practice = practiceSummary(v.practice.filter((p) => p.status));
  const sharedReflections = v.practice.filter((p) => p.reflection || p.note);

  // Exercise menu: workbook and book items by stable reference.
  const menu = exerciseMenu(pack);
  const draft = sp.draft ? await getDraft(coach.id, sp.draft) : null;
  const openEx = work.exercises.filter((x) => x.status !== "DONE").length;
  const nextSession = work.sessions.filter((x) => x.scheduledAt > new Date()).sort((a, b) => +a.scheduledAt - +b.scheduledAt)[0];
  const brief = await latestBrief(coach.id, participantId, v.scopes);
  const wrap = sp.wrap ? await getWrapUp(coach.id, participantId, sp.wrap) : null;
  const lastSession = work.sessions.find((x) => x.scheduledAt <= new Date());
  const first = v.participant.name.split(" (")[0].split(" ")[0];
  const BRIEF_NOTE: Record<string, string> = {
    ai_off: "The AI isn't set up for this app yet, so there's no brief.",
    client_ai_off: `${first} has turned off AI in their own settings, so no brief is made for them. Their choice stands.`,
    nothing_shared: `${first} hasn't shared anything with you yet, so there's nothing to prepare from.`,
    failed: "The brief didn't come through. Try again in a minute.",
  };

  return (
    <>
      {/* Who this is and where they are, in one line. Everything else folds. */}
      <header className="mb-6">
        <p className="eyebrow">Your client</p>
        <h1 className="h1 mt-1">{v.participant.name.replace(/\s*\(Demo\)$/, "")}</h1>
        <p className="mt-2 font-book italic text-[18px] text-ink-soft">
          {v.cycle && pos && s.has("PRACTICE") ? `Day ${pos.day} of 30${v.cycle.focus ? `: ${v.cycle.focus}` : ""}` : v.scopes.length ? `Shares ${v.scopes.length} of ${Object.keys(SHARE_SCOPES).length} areas with you` : "Hasn't shared anything with you yet"}
        </p>
        {flags.length > 0 && <ul className="mt-3 list-disc pl-5 space-y-0.5">{flags.map((f) => <li key={f} className="text-sm text-alert">{f}</li>)}</ul>}
      </header>
      {sp.saved && SAVED_NOTE[sp.saved] && <p role="status" className="notice mb-4">{SAVED_NOTE[sp.saved]}</p>}

      {/* The AI, for this client only: tell it what to do, and nothing happens until you approve. */}
      <section id="assistant" className="scroll-mt-24 border-t border-line/70 py-5">
        <h2 className="font-book text-[23px] text-heading">Ask the AI about {first}</h2>
        <p className="mt-1 text-[15px] text-ink-soft">Say what you want done for {first}: assign an exercise, book a session, change a date. You see the plan before anything happens.</p>
        {sp.done && <p role="status" className="notice mt-3">{Number(sp.done) === 0 ? "Nothing was done." : `Done: ${sp.done} ${Number(sp.done) === 1 ? "action" : "actions"}.`}</p>}
        {sp.assistant && ASSIST_NOTE[sp.assistant] && <p role="status" className="notice mt-3">{ASSIST_NOTE[sp.assistant]}</p>}
        {draft ? <AssistantDraft draft={draft} back={participantId} /> : aiAvailable() ? (
          <form action={planCoachActions} className="mt-3 space-y-3">
            <input type="hidden" name="participantId" value={participantId} />
            <textarea name="instruction" required maxLength={4000} rows={2} className="textarea !min-h-[72px]" aria-label={`What should the AI do for ${first}?`} placeholder={`Assign ${first} the Mirrors road test, due Friday. Book us Tuesday at 10.`} />
            <Submit className="btn-primary">Plan it</Submit>
          </form>
        ) : <p className="mt-3 text-sm text-ink-mute">{BRIEF_NOTE.ai_off}</p>}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <a href={`?open=prep#prep`} className="btn-link">Prepare for the next session</a>
          <a href={`?open=wrapup#wrapup`} className="btn-link">Wrap up a session</a>
        </div>
      </section>

      <Part id="prep" title="Session prep" answer={brief ? `Brief from ${fmt(brief.createdAt, { month: "short", day: "numeric" })}` : "Not prepared yet"} open={!!(brief || sp.brief || sp.open === "prep")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mt-1 text-[15px] text-ink-soft">A one-page brief before you meet: what happened since last time, patterns worth raising, three questions and an exercise to consider. Built only from what {first} shares with you.</p>
          </div>
          {aiAvailable() && (
            <form action={prepareSessionBrief}>
              <input type="hidden" name="participantId" value={participantId} />
              <Submit className={brief ? "btn-quiet" : "btn-primary"}>{brief ? "Refresh the brief" : "Prepare my brief"}</Submit>
            </form>
          )}
        </div>
        {sp.brief && sp.brief !== "new" && BRIEF_NOTE[sp.brief] && <p role="status" className="notice mt-3">{BRIEF_NOTE[sp.brief]}</p>}
        {!aiAvailable() && !sp.brief && !brief && <p className="mt-3 text-sm text-ink-mute">{BRIEF_NOTE.ai_off}</p>}
        {brief && (
          <div className="mt-4 space-y-5">
            <p className="text-xs text-ink-mute">Draft from AI, {fmt(brief.createdAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. Built from: {brief.scopes.length ? brief.scopes.map((x) => SHARE_SCOPES[x as ShareScope]?.split(" (")[0].split(",")[0].split(":")[0] ?? x).join(", ") : "your own session notes"}. Check it against what you know before you use it.</p>
            {brief.content.since.length > 0 && (
              <section>
                <p className="section-label">Since last time</p>
                <ul className="mt-1.5 list-disc pl-5 space-y-1 text-[15px]">{brief.content.since.map((x) => <li key={x}>{x}</li>)}</ul>
              </section>
            )}
            {brief.content.patterns.length > 0 && (
              <section>
                <p className="section-label">Patterns worth raising</p>
                <ul className="mt-1.5 list-disc pl-5 space-y-1 text-[15px]">{brief.content.patterns.map((x) => <li key={x}>{x}</li>)}</ul>
              </section>
            )}
            {brief.content.questions.length > 0 && (
              <section className="border-l-4 border-lane pl-4">
                <p className="section-label">Three questions to ask</p>
                <ol className="mt-1.5 list-decimal pl-5 space-y-1.5 font-serif text-[18px] leading-snug text-heading">{brief.content.questions.map((x) => <li key={x}>{x}</li>)}</ol>
              </section>
            )}
            {brief.content.exercise && (
              <section>
                <p className="section-label">An exercise to consider</p>
                <p className="mt-1.5 text-[15px]"><span className="font-medium text-heading">{brief.content.exercise.title}.</span> {brief.content.exercise.why}</p>
                <form action={assignExercise} className="mt-2">
                  <input type="hidden" name="participantId" value={participantId} />
                  <input type="hidden" name="exerciseRef" value={brief.content.exercise.ref} />
                  <Submit className="btn-quiet !py-1.5 text-sm">Assign this exercise</Submit>
                </form>
              </section>
            )}
            {brief.content.careful && (
              <section>
                <p className="section-label">Handle with care</p>
                <p className="mt-1.5 text-[15px]">{brief.content.careful}</p>
              </section>
            )}
          </div>
        )}
      </Part>

      <Part id="wrapup" title="After-session wrap-up" answer={lastSession ? `Last session ${fmtIn(lastSession.scheduledAt, zone, { month: "short", day: "numeric" })}` : "No past session yet"} open={!!(wrap || sp.wrapped || sp.wrapnote || sp.open === "wrapup")}>
        <p className="mt-1 text-[15px] text-ink-soft">Right after you meet, put down your rough notes. The AI drafts your private notes, the commitments {first} will see, a follow-up message and the next exercise. You edit it before anything is saved.</p>
        {sp.wrapped && <p role="status" className="notice mt-3">Saved to the session. {first} now sees the commitments on their Dashboard.</p>}
        {sp.wrapnote && <p role="status" className="notice mt-3">{sp.wrapnote === "ai_off" ? BRIEF_NOTE.ai_off : BRIEF_NOTE.failed}</p>}
        {!wrap && (aiAvailable() ? (
          <form action={draftSessionWrapUp} className="mt-3 space-y-3">
            <input type="hidden" name="participantId" value={participantId} />
            <p className="text-sm text-ink-mute">{lastSession ? `For your session on ${fmtIn(lastSession.scheduledAt, zone, { weekday: "long", month: "short", day: "numeric" })}.` : "No past session on record, so saving will add one for today."}</p>
            <textarea name="rough" required maxLength={8000} rows={4} className="textarea" aria-label="Rough notes from the session" placeholder="Talked about the director meeting. Pause works with peers, not with him yet. She'll try one question before answering on Thursday. Book Reggie by Friday. Next time: how Thursday went." />
            <Submit className="btn-primary">Draft the wrap-up</Submit>
          </form>
        ) : <p className="mt-3 text-sm text-ink-mute">{BRIEF_NOTE.ai_off}</p>)}
        {wrap && (
          <form action={saveSessionWrapUp} className="mt-4 space-y-4">
            <input type="hidden" name="participantId" value={participantId} />
            <input type="hidden" name="draftId" value={wrap.id} />
            <p className="text-xs text-ink-mute">Draft from AI{wrap.draft.sessionAt ? `, for your session on ${fmt(new Date(wrap.draft.sessionAt), { month: "short", day: "numeric" })}` : ", saved as a session today"}. Check every line before you save.</p>
            <Field label="Your notes" hint="Private to you."><textarea name="coachNotes" defaultValue={wrap.draft.notes} rows={7} className="textarea" /></Field>
            <Field label={`Commitments ${first} will see`} hint="Shown on their Dashboard. Leave empty if nothing was agreed."><textarea name="commitments" defaultValue={wrap.draft.commitments} rows={5} className="textarea" /></Field>
            {wrap.draft.followUp && (
              <div>
                <p className="label">Follow-up message</p>
                <p className="mt-1 rounded-2xl bg-ink/[0.04] px-4 py-3 text-[15px] whitespace-pre-line">{wrap.draft.followUp}</p>
                <div className="mt-2"><CopyText text={wrap.draft.followUp} label="Send it by text or email" /></div>
              </div>
            )}
            {wrap.draft.exercise && (
              <label className="flex items-start gap-3 rounded-2xl bg-ink/[0.04] p-3">
                <input type="checkbox" name="assign" className="mt-1 h-4 w-4 accent-navy" />
                <span className="text-[15px]">Also assign <span className="font-medium text-heading">{wrap.draft.exercise.title}</span>. <span className="text-ink-soft">{wrap.draft.exercise.why}</span></span>
              </label>
            )}
            <div className="flex flex-wrap gap-3">
              <Submit className="btn-primary">Save to the session</Submit>
              <Submit formAction={discardSessionWrapUp} className="btn-quiet">Discard</Submit>
            </div>
          </form>
        )}
      </Part>

      <Part id="assignments" title="Assignments" answer={work.exercises.length ? `${work.exercises.length} assigned, ${openEx} open` : "None yet"} open={["exercise", "assigned", "removed"].includes(sp.saved ?? "")}>
        {work.exercises.length === 0 && <p className="text-[15px] text-ink-soft">Nothing assigned to {first} yet.</p>}
        <ul className="divide-y divide-line/60">
          {work.exercises.map((x) => (
            <li key={x.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-book text-[19px] leading-snug text-heading">{x.title}</p>
                  <p className="mt-0.5 text-sm text-ink-mute">{EX_STATUS[x.status] ?? x.status}{x.dueOn ? `, due ${fmt(x.dueOn)}` : ""}</p>
                </div>
              </div>
              {x.response && <p className="mt-2 rounded-xl bg-ink/[0.04] px-3 py-2 text-[15px]"><span className="text-ink-mute">{first}&apos;s response: </span>{x.response}</p>}
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-link">Edit or remove</summary>
                <form action={updateExercise} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={x.id} /><input type="hidden" name="participantId" value={participantId} />
                  <Field label="Title"><input name="title" required defaultValue={x.title} maxLength={200} className="input" /></Field>
                  <Field label="Instructions"><textarea name="instructions" defaultValue={x.instructions} className="textarea" /></Field>
                  <Field label="Due"><input type="date" name="dueOn" defaultValue={x.dueOn ? x.dueOn.toISOString().slice(0, 10) : ""} className="input" /></Field>
                  <div className="flex flex-wrap gap-3">
                    <Submit className="btn-primary">Save changes</Submit>
                    <Submit formAction={deleteExercise} className="btn-quiet !text-alert">Remove this assignment</Submit>
                  </div>
                </form>
              </details>
            </li>
          ))}
        </ul>
        <details id="new-exercise" className="mt-4 border-t border-line/60 pt-4" open={work.exercises.length === 0}>
          <summary className="cursor-pointer font-book text-[19px] text-heading">Assign a new exercise</summary>
          <form action={assignExercise} className="mt-3 space-y-3">
            <input type="hidden" name="participantId" value={participantId} />
            <Field label="From the program">
              <select name="exerciseRef" className="input">
                <option value="custom">Custom exercise</option>
                {menu.map((m) => <option key={m.ref} value={m.ref}>{m.title}</option>)}
              </select>
            </Field>
            <Field label="Title" hint="Leave blank to use the program title."><input name="title" className="input" /></Field>
            <Field label="Instructions" hint="Leave blank to send the program text as written."><textarea name="instructions" className="textarea" /></Field>
            <Field label="Due"><input type="date" name="dueOn" className="input" /></Field>
            <Submit className="btn-quiet">Assign</Submit>
          </form>
        </details>
      </Part>

      <Part id="sessions" title="Sessions" answer={nextSession ? `Next: ${fmtIn(nextSession.scheduledAt, zone, SESSION_TIME)}` : "None booked"} open={["session", "booked", "notes", "removed-session"].includes(sp.saved ?? "")}>
        {work.sessions.length === 0 && <p className="text-[15px] text-ink-soft">No sessions with {first} yet.</p>}
        <ul className="divide-y divide-line/60">
          {work.sessions.map((ss) => (
            <li key={ss.id} className="py-3">
              <p className="font-book text-[19px] text-heading">{fmtIn(ss.scheduledAt, zone, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}{ss.scheduledAt > new Date() && <span className="ml-2 align-middle text-[12px] font-bold text-gold">Upcoming</span>}</p>
              {ss.agenda && <p className="mt-0.5 text-sm text-ink-soft">Agenda: {ss.agenda}</p>}
              {ss.participantPrep && <p className="mt-2 rounded-xl bg-ink/[0.04] px-3 py-2 text-[15px]"><span className="text-ink-mute">{first}&apos;s prep note: </span>{ss.participantPrep}</p>}
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-link">Notes and commitments</summary>
                <form action={saveSessionNotes} className="mt-3 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="id" value={ss.id} /><input type="hidden" name="participantId" value={participantId} />
                  <Field label="Agreed commitments" hint={`${first} sees these.`}><textarea name="commitments" defaultValue={ss.commitments} className="textarea !min-h-[80px]" /></Field>
                  <Field label="Your notes" hint="Private to you."><textarea name="coachNotes" defaultValue={ss.coachNotes} className="textarea !min-h-[80px]" /></Field>
                  <div className="md:col-span-2"><Submit className="btn-quiet">Save</Submit></div>
                </form>
              </details>
              <details className="mt-1">
                <summary className="cursor-pointer text-sm text-link">Change or cancel</summary>
                <form action={updateSession} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={ss.id} /><input type="hidden" name="participantId" value={participantId} /><TimezoneField />
                  <Field label="When"><input type="datetime-local" name="scheduledAt" required defaultValue={toWallTime(ss.scheduledAt, zone)} className="input min-w-0 max-w-full" /></Field>
                  <Field label="Agenda"><textarea name="agenda" defaultValue={ss.agenda} className="textarea !min-h-[64px]" /></Field>
                  <div className="flex flex-wrap gap-3">
                    <Submit className="btn-primary">Save changes</Submit>
                    <Submit formAction={deleteSession} className="btn-quiet !text-alert">Cancel this session</Submit>
                  </div>
                </form>
              </details>
            </li>
          ))}
        </ul>
        <details id="new-session" className="mt-4 border-t border-line/60 pt-4" open={work.sessions.length === 0}>
          <summary className="cursor-pointer font-book text-[19px] text-heading">Book a session</summary>
          <form action={scheduleSession} className="mt-3 space-y-3">
            <input type="hidden" name="participantId" value={participantId} /><TimezoneField />
            <Field label="When" hint="Your own time. Your client sees it in theirs."><input type="datetime-local" name="scheduledAt" required className="input" /></Field>
            <Field label="Agenda"><textarea name="agenda" className="textarea !min-h-[64px]" /></Field>
            <Submit className="btn-quiet">Schedule</Submit>
          </form>
        </details>
      </Part>

      <Part id="shared" title={`What ${first} shares with you`} answer={v.scopes.length ? v.scopes.map((x) => SHARE_SCOPES[x as ShareScope].split(" (")[0].split(",")[0].split(":")[0]).join(", ") : "Nothing yet"} open={false}>
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <p className="eyebrow">Current development focus</p>
          {s.has("GOALS") ? (
            <>
              {pk ? <p className="mt-3 flex items-center gap-2 h3"><PillarMark k={pk} /> {pack.pillars.find((p) => p.key === pk)?.name}</p> : <p className="mt-2 muted">No priority chosen.</p>}
              {v.profile?.forgeStatement && <p className="mt-3 font-serif text-[16px] leading-relaxed">{v.profile.forgeStatement}</p>}
              {FORGE_LINES.some((l) => v.profile?.[l.field]) && (
                <ul className="mt-3 space-y-1.5">
                  {FORGE_LINES.filter((l) => v.profile?.[l.field]).map((l) => (
                    <li key={l.field} className="text-sm"><span className="text-ink-mute">{l.pillar}, {l.label}: </span>{v.profile![l.field]}</li>
                  ))}
                </ul>
              )}
            </>
          ) : <div className="mt-3"><NotShared scope="GOALS" /></div>}
        </Card>
        <Card>
          <p className="eyebrow">Areas requiring coaching attention</p>
          {flags.length ? <ul className="mt-3 space-y-2">{flags.map((f) => <li key={f} className="text-[15px] text-alert">{f}</li>)}</ul> : <p className="mt-3 text-sm muted">Nothing flagged from the shared data.</p>}
        </Card>
      </div>

      <Card className="mt-5">
        <p className="eyebrow">30-day plan</p>
        {s.has("PLAN") && v.plan ? (
          v.plan.plan || v.plan.situation ? (
            <div className="mt-3 space-y-2 text-[15px]">
              {v.plan.plan && <p className="font-serif text-lg leading-snug">{v.plan.plan}</p>}
              {[["The moment", v.plan.situation], ["The feeling", v.plan.feeling], ["What I usually do", v.plan.oldResponse], ["What I'll do instead", v.plan.newResponse], ["What makes it hard", v.plan.gap]].filter(([, t]) => t).map(([l, t]) => (
                <p key={l}><span className="text-ink-mute">{l}: </span>{t}</p>
              ))}
            </div>
          ) : <p className="mt-2 text-sm text-ink-mute">No plan yet.</p>
        ) : <NotShared scope="PLAN" />}
      </Card>

      <Card className="mt-5">
        <p className="eyebrow">Evidence of practice</p>
        {s.has("PRACTICE") ? (
          <>
            {v.cycle && pos && week && (
              <p className="mt-3 text-[15px]"><span className="font-medium">{v.cycle.seasonMonth ? `Season month ${v.cycle.seasonMonth} of 3, ` : ""}Day {pos.day}, {week.phase}.</span> {v.cycle.focus}{v.cycle.status === "COMPLETED" && v.cycle.decision ? `, Day 30 decision: ${DAY30_DECISIONS[v.cycle.decision as keyof typeof DAY30_DECISIONS]}` : ""}</p>
            )}
            <p className="mt-2 text-sm">Last 30 entries: {practice.done} done, {practice.partial} partial, {practice.notYet} not yet</p>
            {(() => {
              const counts = new Map<string, number>();
              v.practice.forEach((p) => p.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
              return counts.size > 0 ? <p className="mt-1 text-sm muted">Where it showed up: {[...counts].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} (${n})`).join(", ")}</p> : null;
            })()}
            <div className="mt-3 flex gap-1">
              {[...v.practice].reverse().map((p) => <span key={p.date} title={`${p.date} ${p.status}`} className={`h-4 flex-1 rounded ${p.status === "DONE" ? PILLAR_FILL[stripPillar].full : p.status === "PARTIAL" ? PILLAR_FILL[stripPillar].part : "bg-line"}`} />)}
            </div>
          </>
        ) : <div className="mt-3"><NotShared scope="PRACTICE" /></div>}
      </Card>

      <div className="grid gap-5 md:grid-cols-2 mt-5">
        <Card>
          <p className="eyebrow">Where I am</p>
          {s.has("ASSESSMENT") ? (scores ? (
            <ul className="mt-3 space-y-2">
              {PILLAR_KEYS.map((k) => <li key={k} className="flex items-center gap-3"><PillarMark k={k} size="sm" /><span className="flex-1 text-sm">{pack.pillars.find((p) => p.key === k)?.name}</span><span className="text-sm font-medium text-heading">{positionWord(scores[k])}</span></li>)}
              <li className="text-sm muted pt-1">Self-placed against their own lines, {fmt(v.assessment!.completedAt)}</li>
            </ul>
          ) : <p className="mt-2 muted text-sm">No assessment yet.</p>) : <div className="mt-3"><NotShared scope="ASSESSMENT" /></div>}
        </Card>
        <Card>
          <p className="eyebrow">Upcoming accountability</p>
          {s.has("NETWORK") ? (
            <ul className="mt-3 divide-y divide-line">
              {v.relationships.map((r) => <li key={r.id} className="py-2 flex justify-between text-[15px]"><span>{r.name}<span className="muted text-sm">, {RELATIONSHIP_ROLES[r.role as keyof typeof RELATIONSHIP_ROLES]}</span></span><span className="text-sm muted">{fmt(r.nextCheckIn)}</span></li>)}
            </ul>
          ) : <div className="mt-3"><NotShared scope="NETWORK" /></div>}
        </Card>
      </div>

      <Card className="mt-5">
        <p className="eyebrow">Participant-approved reflections</p>
        {s.has("REFLECTIONS") ? (
          sharedReflections.length || v.weekly.length ? (
            <ul className="mt-3 space-y-3">
              {v.weekly.map((w) => <li key={w.id} className="rounded-xl bg-paper p-3 text-[15px]"><p className="text-xs text-ink-mute">Week of {fmt(w.weekOf)}, did it: {w.didIt || "-"}</p><p>Built: {w.built}</p><p>Avoided: {w.avoided}</p><p>Next: {w.nextWeek}</p></li>)}
              {sharedReflections.map((r) => <li key={r.date} className="rounded-xl bg-paper p-3 text-[15px]"><p className="text-xs text-ink-mute">{fmt(r.date)}{r.status ? `, ${CHECKIN_STATUS[r.status as keyof typeof CHECKIN_STATUS]}` : ""}</p>{r.note && <p>{r.note}</p>}{r.reflection && <p className="text-ink-soft">{r.reflection}</p>}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm muted">Reflection sharing is on, but no individual entries are marked shared.</p>
        ) : <div className="mt-3"><NotShared scope="REFLECTIONS" /></div>}
      </Card>

      {s.has("BLUEPRINT") && v.commitments.length > 0 && (
        <Card className="mt-5">
          <p className="eyebrow">The Vehicle Controls</p>
          <ul className="mt-3 space-y-1 text-[15px]">{v.commitments.map((c) => <li key={c.id}>{c.title}{c.when ? <span className="muted">, {c.when}</span> : null}</li>)}</ul>
        </Card>
      )}

      {s.has("IDENTITY") && (
        <Card className="mt-5">
          <p className="eyebrow">The Driver's Seat</p>
          {v.identity ? (
            <>
              <p className="mt-2 text-sm">{v.identity.role && <span className="font-medium">As {withArticle(v.identity.role)}, </span>}<span className="chip">{LEVELS[v.identity.level as IdentityLevel].name}</span> <span className="text-ink-mute">The client chose this kind of change.</span></p>
              <p className="mt-3 font-serif text-[16px] leading-relaxed">{v.identity.becoming}</p>
              {v.identity.situation && <p className="mt-2 text-[15px]"><span className="text-ink-mute">Why now: </span>{v.identity.situation}</p>}
              {v.identity.behavior && <p className="mt-1 text-[15px]"><span className="text-ink-mute">Behavior that shows it: </span>{v.identity.behavior}</p>}
              {v.identity.persona && (
                <div className="mt-3 rounded-xl bg-paper p-3 text-[15px] space-y-1">
                  <p className="text-xs text-ink-mute">Performance identity, shared by the client</p>
                  {v.identity.persona.name && <p className="font-medium">{v.identity.persona.name}</p>}
                  {v.identity.persona.standards && <p><span className="text-ink-mute">Standards: </span>{v.identity.persona.standards}</p>}
                  {v.identity.persona.cue && <p><span className="text-ink-mute">Activation cue: </span>{v.identity.persona.cue}</p>}
                </div>
              )}
              {(() => {
                const a = v.practice.filter((p) => p.identityActed);
                const yes = a.filter((p) => p.identityActed === "YES").length, partly = a.filter((p) => p.identityActed === "PARTLY").length;
                return a.length ? <p className="mt-3 text-sm">Showed up as who they are, last {a.length} answers: {yes} yes, {partly} partly, {a.length - yes - partly} not yet</p> : null;
              })()}
            </>
          ) : <p className="mt-2 text-sm muted">Sharing is on, but the client has not claimed who they are yet.</p>}
        </Card>
      )}

      <Card className="mt-5">
        <p className="eyebrow">My feedback</p>
        {s.has("FEEDBACK") ? (
          v.feedback.length ? (
            <ul className="mt-3 space-y-4">
              {v.feedback.map((f) => (
                <li key={f.id}>
                  <p className="text-[15px] font-medium">{f.title}{f.takenOn ? <span className="font-normal text-ink-mute">, {f.takenOn.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span> : null}</p>
                  {f.summary && <p className="mt-1 whitespace-pre-line font-serif text-[16px] leading-relaxed">{f.summary}</p>}
                  {(JSON.parse(f.pillars || "[]") as string[]).length > 0 && <p className="mt-1 text-sm text-ink-mute">Linked to FORGE {(JSON.parse(f.pillars) as string[]).join(", ")}</p>}
                  {f.fileName && <a href={`/feedback/${f.id}/file`} target="_blank" rel="noopener" className="mt-1 inline-block text-sm btn-link">{f.fileName}</a>}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-ink-mute">Nothing shared yet.</p>
        ) : <NotShared scope="FEEDBACK" />}
      </Card>

      {s.has("EQI") && (
        <Card className="mt-5">
          <p className="eyebrow">What they're working on from their feedback (shared one at a time)</p>
          {v.eqi.length === 0 && <p className="mt-2 text-sm muted">None approved.</p>}
          {v.eqi.map((e) => (
            <div key={e.id} className="mt-4 rounded-xl bg-paper p-3">
              <p className="font-medium flex items-center gap-2">{e.pillar && <PillarMark k={e.pillar as PillarKey} size="sm" />}{e.label}</p>
              {e.practice && <p className="text-sm">Practice: {e.practice}</p>}
              <form action={recordEqiInterpretation} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={e.id} /><input type="hidden" name="participantId" value={participantId} />
                <Field label="Your interpretation" hint="Saving sends it back to the participant for approval before it is visible again."><textarea name="coachInterpretation" defaultValue={e.coachInterpretation} className="textarea !min-h-[64px]" /></Field>
                <Submit className="btn-quiet">Record for approval</Submit>
              </form>
            </div>
          ))}
        </Card>
      )}

      </Part>

      <Part id="account" title="Account" answer={`Reset ${first}'s password, or remove ${first} from your clients`} open={false}>
      <details>
        <summary className="cursor-pointer text-sm text-ink-mute">Reset {v.participant.name.split(" (")[0]}&apos;s password</summary>
        <div className="mt-3"><ResetPasswordForm participantId={participantId} /></div>
      </details>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-ink-mute">Stop coaching {v.participant.name.split(" (")[0]}</summary>
        <form action={removeClient} className="mt-3">
          <input type="hidden" name="participantId" value={participantId} />
          <p className="text-sm muted mb-2">This takes them off your client list and clears what they shared with you. Their own records are kept. You can add them again later.</p>
          <Submit className="btn-quiet !text-alert">Remove from my clients</Submit>
        </form>
      </details>
      </Part>
    </>
  );
}

const SAVED_NOTE: Record<string, string> = {
  exercise: "Assignment saved.", assigned: "Assigned.", removed: "Assignment removed.",
  session: "Session updated.", booked: "Session booked.", notes: "Notes saved.", "removed-session": "Session cancelled.",
};
const ASSIST_NOTE: Record<string, string> = {
  ai_off: "The AI isn't set up for this app yet.",
  no_clients: "This client isn't on your list.",
  failed: "That didn't come through. Try again, or say it a little differently.",
};
const EX_STATUS: Record<string, string> = { ASSIGNED: "Not started", DONE: "Done", PARTIAL: "Partly done", NOT_YET: "Not yet" };

/** One part of the client page. Closed, it says what's in it; open, it's where you work. */
function Part({ id, title, answer, open, children }: { id: string; title: string; answer: string; open: boolean; children: React.ReactNode }) {
  return (
    <details id={id} open={open} className="group/part scroll-mt-24 border-t border-line/70 py-5">
      <summary className="flex cursor-pointer list-none items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="block font-book text-[23px] leading-tight text-heading">{title}</span>
          <span className="mt-1 text-[15px] text-ink-soft line-clamp-2 group-open/part:hidden">{answer}</span>
        </span>
        <span aria-hidden className="mt-2.5 h-2.5 w-2.5 shrink-0 rotate-45 border-b-[1.6px] border-r-[1.6px] border-ink-mute transition group-open/part:-rotate-[135deg] group-open/part:mt-3.5" />
      </summary>
      <div className="pt-4">{children}</div>
    </details>
  );
}
