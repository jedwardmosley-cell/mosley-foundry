import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { respondExercise, saveSessionPrep } from "@/app/actions/participant";
import { fmt } from "@/lib/dates";
import { PageHeader, Card, Field, Empty } from "@/components/ui";
import { Submit } from "@/components/Submit";

export const metadata = { title: "Coaching" };

export default async function CoachingPage() {
  const u = await requireUser("PARTICIPANT");
  const [sessions, exercises] = await Promise.all([
    db.coachingSession.findMany({ where: { participantId: u.id }, orderBy: { scheduledAt: "desc" }, include: { coach: { select: { name: true } } } }),
    db.assignedExercise.findMany({ where: { participantId: u.id }, orderBy: { createdAt: "desc" }, include: { coach: { select: { name: true } } } }),
  ]);
  return (
    <>
      <PageHeader eyebrow="With your coach" title="Coaching">Sessions, agreed commitments, and exercises your coach assigned. Your responses stay private unless you choose to share them.</PageHeader>
      <h2 className="h2 mb-3">Assigned exercises</h2>
      {exercises.length === 0 && <Empty title="Nothing assigned yet" />}
      <div className="space-y-4">
        {exercises.map((x) => (
          <Card key={x.id}>
            <p className="text-xs text-ink-mute">From {x.coach.name}{x.dueOn ? ` · due ${fmt(x.dueOn)}` : ""}</p>
            <h3 className="h3 mt-1">{x.title}</h3>
            {x.instructions && <p className="mt-2 text-[15px] whitespace-pre-wrap">{x.instructions}</p>}
            <form action={respondExercise} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={x.id} />
              <Field label="My response"><textarea name="response" defaultValue={x.response} className="textarea" maxLength={6000} /></Field>
              <div className="flex flex-wrap gap-4 items-center">
                {[["DONE", "Done"], ["PARTIAL", "Partial"], ["NOT_YET", "Not yet"]].map(([v, l]) => (
                  <label key={v} className="flex items-center gap-1.5 text-sm"><input type="radio" name="status" value={v} required defaultChecked={x.status === v} className="accent-navy" />{l}</label>
                ))}
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="responseShared" defaultChecked={x.responseShared} className="accent-navy" /> Share my response with my coach</label>
              </div>
              <Submit className="btn-quiet">Save</Submit>
            </form>
          </Card>
        ))}
      </div>
      <h2 className="h2 mt-10 mb-3">Sessions</h2>
      {sessions.length === 0 && <Empty title="No sessions scheduled" />}
      <div className="space-y-4">
        {sessions.map((s) => (
          <Card key={s.id}>
            <p className="h3">{fmt(s.scheduledAt, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} · {s.coach.name}</p>
            {s.agenda && <p className="mt-2 text-[15px]"><span className="text-ink-mute">Agenda: </span>{s.agenda}</p>}
            {s.commitments && <p className="mt-2 text-[15px]"><span className="text-ink-mute">Agreed commitments: </span>{s.commitments}</p>}
            <form action={saveSessionPrep} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={s.id} />
              <Field label="My prep note" hint="Your coach can read this once you save it."><textarea name="participantPrep" defaultValue={s.participantPrep} className="textarea" maxLength={4000} /></Field>
              <Submit className="btn-quiet">Save prep</Submit>
            </form>
          </Card>
        ))}
      </div>
    </>
  );
}
