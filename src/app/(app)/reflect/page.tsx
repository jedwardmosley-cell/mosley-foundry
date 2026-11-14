import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { saveWeekly, skipWeekSend } from "@/app/actions/participant";
import { cyclePosition } from "@/lib/cycle";
import { WEEK_QUESTIONS, REAL_CHOICES, WORKING_CHOICES, GAP_CHOICES, FIRST_GUESS, weekMessage } from "@/content/weekOne";
import { ShareSend } from "@/components/ShareSend";
import { mondayOf, fmt } from "@/lib/dates";
import { PageHeader, Card, Field, Privacy, Source } from "@/components/ui";
import { Submit } from "@/components/Submit";

export const metadata = { title: "Weekly reflection" };

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
  // Weeks 2 to 4 of the 30 days: the week 1 answers come back with the week's question.
  const cycle = await db.developmentCycle.findFirst({ where: { userId: u.id, status: "ACTIVE" }, orderBy: { startDate: "desc" } });
  const pos = cycle ? cyclePosition(cycle.startDate) : null;
  const lookWeek = cycle?.setupDoneAt && pos && !pos.finished && pos.week >= 2 ? (pos.week as 2 | 3 | 4) : null;
  const answers = JSON.parse(cycle?.weekAnswers || "{}") as Record<string, Record<string, string | boolean>>;
  const thisWeek = lookWeek ? answers[String(lookWeek)] ?? null : null;
  const first = JSON.parse(cycle?.firstGuess || "{}") as Record<string, string>;
  const partner = cycle?.partnerId ? await db.relationship.findFirst({ where: { id: cycle.partnerId, ownerId: u.id, active: true } }) : null;
  const sent = new Set((JSON.parse(cycle?.sharedLog || "[]") as { kind: string }[]).map((x) => x.kind));
  const askSend = !!(lookWeek && thisWeek && partner && !thisWeek.skipSend && !sent.has(`week${lookWeek}`));
  const seg = (name: string, choices: Record<string, string>, value?: string | boolean) => (
    <div className="seg grid-cols-3">
      {Object.entries(choices).map(([v, l]) => (
        <label key={v} className="cursor-pointer">
          <input type="radio" name={name} value={v} defaultChecked={value === v} className="peer sr-only" />
          <span className="seg-opt !py-2.5 !text-[14px] peer-checked:bg-surface peer-checked:text-heading peer-checked:shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_14px_-8px_rgb(0_0_0/0.3)]">{l}</span>
        </label>
      ))}
    </div>
  );
  const held = new Set(JSON.parse(current?.held ?? "[]") as string[]);
  const weekly = pack.discipline.inventory.find((i) => i.label === "Weekly")?.text;
  return (
    <>
      <PageHeader eyebrow={`Week of ${fmt(weekOf, { month: "long", day: "numeric" })}`} title="Look back at your week and plan the next one">
        {weekly ?? "One appointment at the start of the week to decide what matters, and one at the end to look back."}
      </PageHeader>
      {askSend && partner && cycle && lookWeek && (
        <Card className="mb-5">
          <h2 className="font-serif text-[24px] leading-tight text-heading">Send this to {partner.name.split(" ")[0]}?</h2>
          <p className="mt-3 rounded-2xl bg-ink/[0.04] px-4 py-3 text-[15px]">{weekMessage(lookWeek, thisWeek as Record<string, string>, cycle.newResponse)}</p>
          <div className="mt-4 flex items-center gap-5">
            <ShareSend message={weekMessage(lookWeek, thisWeek as Record<string, string>, cycle.newResponse)} to={partner.id} email={partner.email} kind={`week${lookWeek}` as "week2" | "week3" | "week4"} label="Send" />
            <form action={skipWeekSend}><input type="hidden" name="week" value={lookWeek} /><button className="text-[15px] btn-link">Not this week</button></form>
          </div>
        </Card>
      )}
      <Card>
        <form action={saveWeekly} className="space-y-4">
          <input type="hidden" name="weekOf" value={weekOf} />
          {lookWeek && cycle && (
            <section className="space-y-3 border-b border-line/70 pb-6">
              <input type="hidden" name="look_week" value={lookWeek} />
              <p className="section-label">{WEEK_QUESTIONS[lookWeek].title} · look again</p>
              <h2 className="font-serif text-[24px] leading-tight text-heading">{WEEK_QUESTIONS[lookWeek].question}</h2>
              {lookWeek === 2 && (
                <>
                  <label className="block"><span className="text-xs text-ink-mute">{first.situation ? `${FIRST_GUESS} · ` : ""}The situation</span><textarea name="look_situation" defaultValue={cycle.situation} className="textarea mt-1 !min-h-[64px]" maxLength={1500} /></label>
                  <label className="block"><span className="text-xs text-ink-mute">{first.feeling ? `${FIRST_GUESS} · ` : ""}The feeling</span><textarea name="look_feeling" defaultValue={cycle.feeling} className="textarea mt-1 !min-h-[64px]" maxLength={1500} /></label>
                  {seg("look_real", REAL_CHOICES, thisWeek?.real)}
                  <p className="text-xs text-ink-mute">Change the words above if it was something else. Your first guess is kept.</p>
                </>
              )}
              {lookWeek === 3 && (
                <>
                  <p className="rounded-2xl bg-ink/[0.04] px-4 py-3 text-[15px]"><span className="block text-xs text-ink-mute">My new response</span>{cycle.newResponse}</p>
                  <p className="section-label">Working?</p>{seg("look_working", WORKING_CHOICES, thisWeek?.working)}
                  <p className="rounded-2xl bg-ink/[0.04] px-4 py-3 text-[15px]"><span className="block text-xs text-ink-mute">The gap</span>{cycle.gap}</p>
                  <p className="section-label">The gap is</p>{seg("look_gap", GAP_CHOICES, thisWeek?.gap)}
                  <textarea name="look_note" aria-label="Note" placeholder="Anything to add? (optional)" defaultValue={String(thisWeek?.note ?? "")} className="textarea !min-h-[64px]" maxLength={1500} />
                </>
              )}
              {lookWeek === 4 && (
                <>
                  {cycle.plan && <p className="font-serif text-[18px] leading-snug text-heading">{cycle.plan}</p>}
                  <textarea name="look_keep" aria-label="What keeps this going" placeholder="A routine, a person, a reminder, a place..." defaultValue={String(thisWeek?.keep ?? "")} className="textarea !min-h-[80px]" maxLength={1500} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="look_routine" className="h-4 w-4 accent-navy" /> Put it on My road as a weekly routine</label>
                </>
              )}
            </section>
          )}
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
              <legend className="label">Which commitments did you keep this week?</legend>
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
            <summary className="cursor-pointer text-sm text-link">What did I build? What did I avoid? <span className="text-ink-mute">(optional)</span></summary>
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
              {JSON.parse(w.held || "[]").length > 0 && <p className="mt-1 text-sm muted">{JSON.parse(w.held).length} commitment{JSON.parse(w.held).length === 1 ? "" : "s"} kept</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
