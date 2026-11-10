import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { cycleWeeks, cyclePosition, practiceSummary, CYCLE_TEMPLATES } from "@/lib/cycle";
import { saveWeek, completeCycle } from "@/app/actions/participant";
import { DAY30_DECISIONS, CHECKIN_STATUS } from "@/content/program";
import { addDays, fmt, ymd } from "@/lib/dates";
import type { PillarKey } from "@/content/types";
import { PageHeader, Card, PillarMark, Empty, Draft, Field, Source } from "@/components/ui";
import { Submit } from "@/components/Submit";

export const metadata = { title: "30-Day Cycle" };

export default async function CyclePage() {
  const u = await requireUser("PARTICIPANT");
  const { pack } = await getContent();
  const cycle = await db.developmentCycle.findFirst({ where: { userId: u.id, status: "ACTIVE" }, orderBy: { startDate: "desc" } });
  const past = await db.developmentCycle.findMany({ where: { userId: u.id, status: { not: "ACTIVE" } }, orderBy: { startDate: "desc" }, take: 5 });
  if (!cycle) {
    return (
      <>
        <PageHeader eyebrow="30-day development cycle" title="No active cycle" />
        <Empty title="Start a 30-day cycle" href="/cycle/new" cta="Start">One pillar. One behavior. Four weeks.</Empty>
        {past.length > 0 && <PastCycles past={past} />}
      </>
    );
  }
  const { weeks, decide } = cycleWeeks(cycle.template, pack);
  const pos = cyclePosition(cycle.startDate);
  const p = pack.pillars.find((x) => x.key === (cycle.pillar as PillarKey))!;
  const checkIns = await db.dailyCheckIn.findMany({ where: { userId: u.id, cycleId: cycle.id }, orderBy: { date: "asc" } });
  const byDate = new Map(checkIns.map((c) => [c.date, c]));
  const notes = JSON.parse(cycle.weekNotes) as Record<string, string>;
  const wstat = JSON.parse(cycle.weekStatus) as Record<string, string>;
  const sum = practiceSummary(checkIns);

  return (
    <>
      <PageHeader eyebrow={`${CYCLE_TEMPLATES[cycle.template as keyof typeof CYCLE_TEMPLATES]?.name ?? "Cycle"} · started ${fmt(cycle.startDate)}`} title={`Day ${pos.day} of 30`}>
        <span className="inline-flex items-center gap-2"><PillarMark k={p.key} size="sm" /> {p.name}{cycle.focus ? `: ${cycle.focus}` : ""}</span>
      </PageHeader>

      <Card>
        <div className="grid grid-cols-10 gap-1.5" role="img" aria-label={`${sum.done} done, ${sum.partial} partial, ${sum.notYet} not yet`}>
          {Array.from({ length: 30 }, (_, i) => {
            const date = ymd(addDays(cycle.startDate, i));
            const c = byDate.get(date);
            const isToday = i + 1 === pos.day && !pos.finished;
            const tone = c?.status === "DONE" ? "bg-navy text-white" : c?.status === "PARTIAL" ? "bg-brass text-white" : c?.status === "NOT_YET" ? "bg-line" : "bg-white";
            return <span key={i} title={`Day ${i + 1}${c ? `: ${CHECKIN_STATUS[c.status as keyof typeof CHECKIN_STATUS]}` : ""}`} className={`aspect-square rounded-md border border-line text-[10px] flex items-center justify-center ${tone} ${isToday ? "ring-2 ring-brass" : ""}`}>{i + 1}</span>;
          })}
        </div>
        <p className="mt-3 text-sm muted">{sum.done} done · {sum.partial} partial · {sum.notYet} not yet. Log today from the <Link href="/dashboard" className="btn-link">Today</Link> screen.</p>
      </Card>

      <div className="mt-5 space-y-4">
        {weeks.map((w) => {
          const current = w.week === pos.week && !pos.finished;
          return (
            <Card key={w.week} className={current ? "border-navy/40" : w.week > pos.week ? "opacity-80" : ""}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="h2">Week {w.week} · {w.phase}</h2>
                {current && <span className="chip !border-brass !text-brass">This week</span>}
              </div>
              <p className="mt-2 text-[15px] leading-relaxed">{w.work}</p>
              {w.status !== "source" && <p className="mt-2"><Draft>From the build brief; workbook assignments pending</Draft></p>}
              {w.week <= pos.week && (
                <form action={saveWeek} className="mt-4 space-y-3">
                  <input type="hidden" name="id" value={cycle.id} />
                  <input type="hidden" name="week" value={w.week} />
                  <Field label={["What I observed", "What shifted", "What the feedback revealed", "What changed in how I see the work"][w.week - 1] ?? "Notes"}>
                    <textarea name="note" defaultValue={notes[w.week]} className="textarea" maxLength={4000} />
                  </Field>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm">Did I do it?</span>
                    {Object.entries(CHECKIN_STATUS).map(([k, v]) => (
                      <label key={k} className="flex items-center gap-1.5 text-sm"><input type="radio" name="status" value={k} defaultChecked={wstat[w.week] === k} className="accent-navy" />{v}</label>
                    ))}
                  </div>
                  <Submit className="btn-quiet">Save week {w.week}</Submit>
                </form>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-5">
        <p className="eyebrow">Day 30 · Decide</p>
        {decide && <p className="mt-2 text-[15px] leading-relaxed">{decide}</p>}
        {pos.day >= 28 || pos.finished ? (
          <form action={completeCycle} className="mt-4 space-y-4">
            <input type="hidden" name="id" value={cycle.id} />
            <Field label="Final review" hint="What did you practice? What evidence do you have that anything changed? What surprised you?">
              <textarea name="finalReview" className="textarea min-h-[140px]" maxLength={6000} required />
            </Field>
            <fieldset className="space-y-2">
              <legend className="label">Your answer</legend>
              {Object.entries(DAY30_DECISIONS).map(([k, v]) => (
                <label key={k} className="flex items-center gap-2 text-[15px]"><input type="radio" name="decision" value={k} required className="accent-navy" />{v}</label>
              ))}
            </fieldset>
            <div className="flex flex-wrap gap-3">
              <Submit>Complete the cycle</Submit>
              <Link href="/assessment" className="btn-quiet">Re-take the assessment first</Link>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-sm muted">Opens on day 28.</p>
        )}
        <Source>{cycle.template === "WORKBOOK_30" ? "Personal Application Workbook, Section Seven" : "Build brief: 30-Day Development Cycle"}</Source>
      </Card>
      {past.length > 0 && <PastCycles past={past} />}
    </>
  );
}

function PastCycles({ past }: { past: { id: string; pillar: string; startDate: Date; status: string; decision: string }[] }) {
  return (
    <Card className="mt-6">
      <p className="eyebrow">Earlier cycles</p>
      <ul className="mt-2 divide-y divide-line">
        {past.map((c) => (
          <li key={c.id} className="py-2 flex justify-between text-[15px]">
            <span>{c.pillar} · {fmt(c.startDate, { month: "short", day: "numeric", year: "numeric" })}</span>
            <span className="muted text-sm">{c.status === "COMPLETED" ? DAY30_DECISIONS[c.decision as keyof typeof DAY30_DECISIONS] ?? "Completed" : "Stopped"}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
