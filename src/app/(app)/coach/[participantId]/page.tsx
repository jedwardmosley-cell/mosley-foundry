import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCoachView, getCoachWork, ForbiddenError, SHARE_SCOPES, type ShareScope } from "@/lib/access";
import { attentionFlags } from "@/lib/coachSummary";
import { assignExercise, scheduleSession, saveSessionNotes, recordEqiInterpretation } from "@/app/actions/coach";
import { getContent } from "@/content";
import { cycleWeeks, cyclePosition, practiceSummary } from "@/lib/cycle";
import { scoresFrom, total } from "@/lib/forge";
import { RELATIONSHIP_ROLES, SEGMENTS, CHECKIN_STATUS, DAY30_DECISIONS } from "@/content/program";
import { fmt } from "@/lib/dates";
import type { PillarKey } from "@/content/types";
import { PILLAR_KEYS } from "@/content/types";
import { PageHeader, Card, PillarMark, Gauge, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";

function NotShared({ scope }: { scope: ShareScope }) {
  return <p className="text-sm text-ink-mute">Not shared: {SHARE_SCOPES[scope].toLowerCase()}.</p>;
}

export default async function CoachParticipant({ params }: { params: Promise<{ participantId: string }> }) {
  const coach = await requireUser("COACH");
  const { participantId } = await params;
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
  const scores = v.assessment ? scoresFrom(v.assessment) : null;
  const pos = v.cycle ? cyclePosition(v.cycle.startDate) : null;
  const week = v.cycle && pos ? cycleWeeks(v.cycle.template, pack).weeks[pos.week - 1] : null;
  const practice = practiceSummary(v.practice.filter((p) => p.status));
  const sharedReflections = v.practice.filter((p) => p.reflection || p.note);

  // Exercise menu: workbook and book items by stable reference.
  const menu = [
    ...pack.edsLessons.map((e, i) => ({ ref: `ed:${i}`, title: `Ed's Lessons: ${e.title}`, text: [e.setup, ...e.prompts].filter(Boolean).join("\n\n") })),
    ...pack.jaysJourney.map((j, i) => ({ ref: `jay:${i}`, title: `Jay's Journey: ${j.title}`, text: [j.setup, ...j.prompts].filter(Boolean).join("\n\n") })),
    ...pack.chapters.filter((c) => c.roadTest.length).map((c) => ({ ref: `chapter:${c.number}:roadTest`, title: `Road Test: ${c.title}`, text: c.roadTest.join("\n\n") })),
    ...SEGMENTS.map((x) => ({ ref: `segment:${x.key}`, title: `Segment ${x.key} practice: ${x.title}`, text: x.practice.text })),
  ];

  return (
    <>
      <PageHeader eyebrow="Participant summary" title={v.participant.name}>
        Shared with you: {v.scopes.length ? v.scopes.map((x) => SHARE_SCOPES[x as ShareScope].split(" (")[0].split(",")[0]).join(" · ") : "nothing yet"}.
      </PageHeader>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <p className="eyebrow">Current development focus</p>
          {s.has("GOALS") ? (
            <>
              {pk ? <p className="mt-3 flex items-center gap-2 h3"><PillarMark k={pk} /> {pack.pillars.find((p) => p.key === pk)?.name}</p> : <p className="mt-2 muted">No priority chosen.</p>}
              {v.profile?.forgeStatement && <p className="mt-3 font-serif text-[16px] leading-relaxed">{v.profile.forgeStatement}</p>}
              {v.goals.filter((g) => g.oneMove).map((g) => <p key={g.id} className="mt-2 text-sm"><span className="text-ink-mute">{g.pillar}{g.segmentKey ? ` (seg. ${g.segmentKey})` : ""} one move: </span>{g.oneMove}</p>)}
            </>
          ) : <div className="mt-3"><NotShared scope="GOALS" /></div>}
        </Card>
        <Card>
          <p className="eyebrow">Areas requiring coaching attention</p>
          {flags.length ? <ul className="mt-3 space-y-2">{flags.map((f) => <li key={f} className="text-[15px] text-clay">{f}</li>)}</ul> : <p className="mt-3 text-sm muted">Nothing flagged from the shared data.</p>}
        </Card>
      </div>

      <Card className="mt-5">
        <p className="eyebrow">Evidence of practice</p>
        {s.has("PRACTICE") ? (
          <>
            {v.cycle && pos && week && (
              <p className="mt-3 text-[15px]"><span className="font-medium">Day {pos.day}, {week.phase}.</span> {v.cycle.focus}{v.cycle.status === "COMPLETED" && v.cycle.decision ? ` · Day 30 decision: ${DAY30_DECISIONS[v.cycle.decision as keyof typeof DAY30_DECISIONS]}` : ""}</p>
            )}
            <p className="mt-2 text-sm">Last 30 entries: {practice.done} done · {practice.partial} partial · {practice.notYet} not yet</p>
            {(() => {
              const counts = new Map<string, number>();
              v.practice.forEach((p) => p.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
              return counts.size > 0 ? <p className="mt-1 text-sm muted">Where it showed up: {[...counts].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} (${n})`).join(" · ")}</p> : null;
            })()}
            <div className="mt-3 flex gap-1">
              {[...v.practice].reverse().map((p) => <span key={p.date} title={`${p.date} ${p.status}`} className={`h-4 flex-1 rounded ${p.status === "DONE" ? "bg-navy" : p.status === "PARTIAL" ? "bg-brass" : "bg-line"}`} />)}
            </div>
          </>
        ) : <div className="mt-3"><NotShared scope="PRACTICE" /></div>}
      </Card>

      <div className="grid gap-5 md:grid-cols-2 mt-5">
        <Card>
          <p className="eyebrow">FORGE reading</p>
          {s.has("ASSESSMENT") ? (scores ? (
            <ul className="mt-3 space-y-2">
              {PILLAR_KEYS.map((k) => <li key={k} className="flex items-center gap-3"><PillarMark k={k} size="sm" /><span className="flex-1 text-sm">{pack.pillars.find((p) => p.key === k)?.name}</span><Gauge value={scores[k]} label={k} /><span className="w-4 text-right">{scores[k]}</span></li>)}
              <li className="text-sm muted pt-1">Total {total(scores)} / 25 · self-rated {fmt(v.assessment!.completedAt)}</li>
            </ul>
          ) : <p className="mt-2 muted text-sm">No assessment yet.</p>) : <div className="mt-3"><NotShared scope="ASSESSMENT" /></div>}
        </Card>
        <Card>
          <p className="eyebrow">Upcoming accountability</p>
          {s.has("NETWORK") ? (
            <ul className="mt-3 divide-y divide-line">
              {v.relationships.map((r) => <li key={r.id} className="py-2 flex justify-between text-[15px]"><span>{r.name} <span className="muted text-sm">· {RELATIONSHIP_ROLES[r.role as keyof typeof RELATIONSHIP_ROLES]}</span></span><span className="text-sm muted">{fmt(r.nextCheckIn)}</span></li>)}
            </ul>
          ) : <div className="mt-3"><NotShared scope="NETWORK" /></div>}
        </Card>
      </div>

      <Card className="mt-5">
        <p className="eyebrow">Participant-approved reflections</p>
        {s.has("REFLECTIONS") ? (
          sharedReflections.length || v.weekly.length ? (
            <ul className="mt-3 space-y-3">
              {v.weekly.map((w) => <li key={w.id} className="rounded-xl bg-paper p-3 text-[15px]"><p className="text-xs text-ink-mute">Week of {fmt(w.weekOf)} · did it: {w.didIt || "-"}</p><p>Built: {w.built}</p><p>Avoided: {w.avoided}</p><p>Next: {w.nextWeek}</p></li>)}
              {sharedReflections.map((r) => <li key={r.date} className="rounded-xl bg-paper p-3 text-[15px]"><p className="text-xs text-ink-mute">{fmt(r.date)}{r.status ? ` · ${CHECKIN_STATUS[r.status as keyof typeof CHECKIN_STATUS]}` : ""}</p>{r.note && <p>{r.note}</p>}{r.reflection && <p className="text-ink-soft">{r.reflection}</p>}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm muted">Reflection sharing is on, but no individual entries are marked shared.</p>
        ) : <div className="mt-3"><NotShared scope="REFLECTIONS" /></div>}
      </Card>

      {s.has("BLUEPRINT") && v.commitments.length > 0 && (
        <Card className="mt-5">
          <p className="eyebrow">Blueprint</p>
          <ul className="mt-3 space-y-1 text-[15px]">{v.commitments.map((c) => <li key={c.id}>{c.title}{c.when ? <span className="muted"> · {c.when}</span> : null}</li>)}</ul>
        </Card>
      )}

      {s.has("EQI") && (
        <Card className="mt-5">
          <p className="eyebrow">EQ-i development priorities (participant-approved)</p>
          {v.eqi.length === 0 && <p className="mt-2 text-sm muted">None approved.</p>}
          {v.eqi.map((e) => (
            <div key={e.id} className="mt-4 rounded-xl bg-paper p-3">
              <p className="font-medium">{e.label}</p>
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

      <h2 className="h2 mt-10 mb-3">Coaching work</h2>
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <h3 className="h3">Assign an exercise</h3>
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
          {work.exercises.length > 0 && (
            <ul className="mt-5 divide-y divide-line">
              {work.exercises.map((x) => <li key={x.id} className="py-2 text-[15px]"><span className="font-medium">{x.title}</span> <span className="muted text-sm">· {x.status.toLowerCase().replace("_", " ")}</span>{x.response && <p className="text-sm text-ink-soft mt-1">{x.response}</p>}</li>)}
            </ul>
          )}
        </Card>
        <Card>
          <h3 className="h3">Schedule a session</h3>
          <form action={scheduleSession} className="mt-3 space-y-3">
            <input type="hidden" name="participantId" value={participantId} />
            <Field label="When"><input type="datetime-local" name="scheduledAt" required className="input" /></Field>
            <Field label="Agenda"><textarea name="agenda" className="textarea !min-h-[64px]" /></Field>
            <Submit className="btn-quiet">Schedule</Submit>
          </form>
        </Card>
      </div>

      {work.sessions.length > 0 && (
        <div className="mt-5 space-y-4">
          {work.sessions.map((ss) => (
            <Card key={ss.id}>
              <p className="h3">{fmt(ss.scheduledAt, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              {ss.agenda && <p className="mt-1 text-sm">Agenda: {ss.agenda}</p>}
              {ss.participantPrep && <div className="mt-3 rounded-xl bg-paper p-3 text-[15px]"><p className="text-xs text-ink-mute">Participant&apos;s prep note</p>{ss.participantPrep}</div>}
              <form action={saveSessionNotes} className="mt-3 grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={ss.id} /><input type="hidden" name="participantId" value={participantId} />
                <Field label="Agreed commitments" hint="Visible to the participant."><textarea name="commitments" defaultValue={ss.commitments} className="textarea !min-h-[80px]" /></Field>
                <Field label="Coach notes" hint="Private to you."><textarea name="coachNotes" defaultValue={ss.coachNotes} className="textarea !min-h-[80px]" /></Field>
                <div className="md:col-span-2"><Submit className="btn-quiet">Save</Submit></div>
              </form>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
