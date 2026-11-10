import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { saveWeekly } from "@/app/actions/participant";
import { mondayOf, fmt } from "@/lib/dates";
import { PageHeader, Card, Field, Privacy, Source } from "@/components/ui";
import { Submit } from "@/components/Submit";

export const metadata = { title: "Weekly Reflection" };

export default async function ReflectPage() {
  const u = await requireUser("PARTICIPANT");
  const { pack } = await getContent();
  const weekOf = mondayOf();
  const [current, past, coach, commitments] = await Promise.all([
    db.weeklyReflection.findUnique({ where: { userId_weekOf: { userId: u.id, weekOf } } }),
    db.weeklyReflection.findMany({ where: { userId: u.id, weekOf: { not: weekOf } }, orderBy: { weekOf: "desc" }, take: 12 }),
    db.coachAssignment.findFirst({ where: { participantId: u.id, active: true } }),
    db.commitment.findMany({ where: { userId: u.id, active: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const held = new Set(JSON.parse(current?.held ?? "[]") as string[]);
  const weekly = pack.discipline.inventory.find((i) => i.label === "Weekly")?.text;
  return (
    <>
      <PageHeader eyebrow={`Week of ${fmt(weekOf, { month: "long", day: "numeric" })}`} title="Look back. Look ahead.">
        {weekly ?? "One appointment to decide what matters before Monday does, one to look back."}
      </PageHeader>
      <Card>
        <form action={saveWeekly} className="space-y-4">
          <input type="hidden" name="weekOf" value={weekOf} />
          <fieldset>
            <legend className="label">Did I do what I said I was going to do?</legend>
            <div className="flex flex-wrap gap-4">
              {[["YES", "Yes"], ["PARTIAL", "Partially"], ["NOT_YET", "Not yet"]].map(([v, l]) => (
                <label key={v} className="flex items-center gap-1.5 text-[15px]"><input type="radio" name="didIt" value={v} defaultChecked={current?.didIt === v} className="accent-navy" />{l}</label>
              ))}
            </div>
          </fieldset>
          {commitments.length > 0 && (
            <fieldset>
              <legend className="label">Which commitments held this week?</legend>
              <div className="space-y-2">
                {commitments.map((c) => (
                  <label key={c.id} className="flex items-start gap-2.5 text-[15px] cursor-pointer">
                    <input type="checkbox" name="held" value={c.id} defaultChecked={held.has(c.id)} className="mt-1 h-4 w-4 accent-navy" />
                    <span>{c.title}{c.when ? <span className="text-ink-mute"> · {c.when}</span> : null}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <Field label="What does next week need?" hint="One line is enough."><input name="nextWeek" defaultValue={current?.nextWeek} className="input" maxLength={4000} /></Field>
          <details open={!!(current?.built || current?.avoided)}>
            <summary className="cursor-pointer text-sm text-navy">What did I build? What did I avoid? <span className="text-ink-mute">(optional)</span></summary>
            <div className="mt-3 space-y-3">
              <Field label="What did I build?"><textarea name="built" defaultValue={current?.built} className="textarea" maxLength={4000} /></Field>
              <Field label="What did I avoid?"><textarea name="avoided" defaultValue={current?.avoided} className="textarea" maxLength={4000} /></Field>
            </div>
          </details>
          {coach && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="shared" defaultChecked={current?.shared} className="h-4 w-4 accent-navy" /> Share this week&apos;s reflection with my coach</label>}
          <Submit>Save this week</Submit>
        </form>
        <Source>Questions from the Discipline by Design session, 3-Day Intensive facilitator guide (default set); Both Hands on the Wheel, Ch. 10</Source>
      </Card>
      {past.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="h2">Earlier weeks</h2>
          {past.map((w) => (
            <Card key={w.id}>
              <div className="flex justify-between items-baseline"><p className="h3">Week of {fmt(w.weekOf)}</p><Privacy shared={w.shared} /></div>
              {w.built && <p className="mt-2 text-[15px]"><span className="text-ink-mute">Built: </span>{w.built}</p>}
              {w.avoided && <p className="mt-1 text-[15px]"><span className="text-ink-mute">Avoided: </span>{w.avoided}</p>}
              {w.nextWeek && <p className="mt-1 text-[15px]"><span className="text-ink-mute">Next: </span>{w.nextWeek}</p>}
              {JSON.parse(w.held || "[]").length > 0 && <p className="mt-1 text-sm muted">{JSON.parse(w.held).length} commitment{JSON.parse(w.held).length === 1 ? "" : "s"} held</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
