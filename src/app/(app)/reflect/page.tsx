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
  const [current, past, coach] = await Promise.all([
    db.weeklyReflection.findUnique({ where: { userId_weekOf: { userId: u.id, weekOf } } }),
    db.weeklyReflection.findMany({ where: { userId: u.id, weekOf: { not: weekOf } }, orderBy: { weekOf: "desc" }, take: 12 }),
    db.coachAssignment.findFirst({ where: { participantId: u.id, active: true } }),
  ]);
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
          <Field label="What did I build?"><textarea name="built" defaultValue={current?.built} className="textarea" maxLength={4000} /></Field>
          <Field label="What did I avoid?"><textarea name="avoided" defaultValue={current?.avoided} className="textarea" maxLength={4000} /></Field>
          <Field label="What does next week need?"><textarea name="nextWeek" defaultValue={current?.nextWeek} className="textarea" maxLength={4000} /></Field>
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
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
