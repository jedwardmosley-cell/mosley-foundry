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
        <Empty title="Start a 30-day cycle" href="/cycle/new" cta="Start">Pick one pillar and one behavior, then work on it for four weeks.</Empty>
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
      <PageHeader eyebrow="Discipline by Design · 30 days" title={`Day ${pos.day} of 30`}>
        <span className="inline-flex items-center gap-2"><PillarMark k={p.key} size="sm" /> {cycle.focus || p.name}</span>
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
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="muted">{sum.done} done · {sum.partial} partial · {sum.notYet} not yet</span>
          {!pos.finished && <Link href="/dashboard" className="btn-link">Check in today</Link>}
        </div>
      </Card>

      {weeks.filter((w) => w.week === pos.week && !pos.finished).map((w) => (
        <Card key={w.week} className="mt-5 border-navy/40">
          <p className="eyebrow">This week</p>
          <h2 className="h2 mt-1">Week {w.week} · {w.phase}</h2>
          <p className="mt-2 text-[15px] leading-relaxed">{w.work}</p>
          <WeekForm cycleId={cycle.id} week={w.week} status={wstat[w.week]} note={notes[w.week]} />
        </Card>
      ))}

      <Card className="mt-5 !p-0">
        <ul className="divide-y divide-line">
          {weeks.filter((w) => !(w.week === pos.week && !pos.finished)).map((w) => {
            const past = w.week < pos.week || pos.finished;
            const st = wstat[w.week] as keyof typeof CHECKIN_STATUS | undefined;
            return (
              <li key={w.week}>
                <details className="px-5 py-3.5">
                  <summary className={`cursor-pointer flex items-center justify-between gap-3 ${past ? "" : "text-ink-mute"}`}>
                    <span className="text-[15px]">Week {w.week} · {w.phase}</span>
                    <span className="text-xs text-ink-mute">{past ? (st ? CHECKIN_STATUS[st] : "Not logged") : "Coming up"}</span>
                  </summary>
                  <p className="mt-2 text-sm text-ink-soft">{w.work}</p>
                  {past && <WeekForm cycleId={cycle.id} week={w.week} status={wstat[w.week]} note={notes[w.week]} />}
                </details>
              </li>
            );
          })}
          <li>
            {pos.day >= 28 || pos.finished ? (
              <div className="px-5 py-4">
                <p className="eyebrow">Day 30 · Decide</p>
                {decide && <p className="mt-2 text-[15px] leading-relaxed">{decide}</p>}
                <form action={completeCycle} className="mt-4 space-y-4">
                  <input type="hidden" name="id" value={cycle.id} />
                  <fieldset className="space-y-2">
                    <legend className="label">Your answer</legend>
                    {Object.entries(DAY30_DECISIONS).map(([k, v]) => (
                      <label key={k} className="flex items-center gap-2 text-[15px]"><input type="radio" name="decision" value={k} required className="accent-navy" />{v}</label>
                    ))}
                  </fieldset>
                  <details>
                    <summary className="cursor-pointer text-sm text-navy">Write a final review <span className="text-ink-mute">(optional)</span></summary>
                    <p className="mt-2 text-xs text-ink-mute">What did you practice? What evidence do you have that anything changed? What surprised you?</p>
                    <textarea name="finalReview" aria-label="Final review" className="textarea min-h-[120px] mt-2" maxLength={6000} />
                  </details>
                  <div className="flex flex-wrap gap-3">
                    <Submit>Complete the cycle</Submit>
                    <Link href="/assessment" className="btn-quiet">Re-take the assessment first</Link>
                  </div>
                </form>
              </div>
            ) : (
              <details className="px-5 py-3.5">
                <summary className="cursor-pointer flex items-center justify-between gap-3 text-ink-mute">
                  <span className="text-[15px]">Day 30 · Decide</span><span className="text-xs">Opens on day 28</span>
                </summary>
                {decide && <p className="mt-2 text-sm text-ink-soft">{decide}</p>}
              </details>
            )}
          </li>
        </ul>
      </Card>
      {weeks[0]?.status !== "source" && <p className="mt-2 text-xs text-ink-mute">Week descriptions are from the build brief. Workbook assignments are pending. <Draft>Draft</Draft></p>}
      <Source>{cycle.template === "WORKBOOK_30" ? "Personal Application Workbook, Section Seven" : "Build brief: 30-Day Development Cycle"}</Source>
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

const WEEK_NOTE = ["What I observed", "What shifted", "What the feedback revealed", "What changed in how I see the work"];

function WeekForm({ cycleId, week, status, note }: { cycleId: string; week: number; status?: string; note?: string }) {
  return (
    <form action={saveWeek} className="mt-4 space-y-3">
      <input type="hidden" name="id" value={cycleId} />
      <input type="hidden" name="week" value={week} />
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm">Did I do it?</span>
        {Object.entries(CHECKIN_STATUS).map(([k, v]) => (
          <label key={k} className="flex items-center gap-1.5 text-sm"><input type="radio" name="status" value={k} defaultChecked={status === k} className="accent-navy" />{v}</label>
        ))}
      </div>
      <details open={!!note}>
        <summary className="cursor-pointer text-sm text-navy">{WEEK_NOTE[week - 1] ?? "Notes"}</summary>
        <textarea name="note" aria-label="Week notes" defaultValue={note} className="textarea mt-2" maxLength={4000} />
      </details>
      <Submit className="btn-quiet">Save week {week}</Submit>
    </form>
  );
}
