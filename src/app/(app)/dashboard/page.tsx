import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadParticipant } from "@/lib/participant";
import { getContent } from "@/content";
import { cycleWeeks, cyclePosition, practiceSummary } from "@/lib/cycle";
import { scoresFrom } from "@/lib/forge";
import { fmt, daysBetween } from "@/lib/dates";
import { RELATIONSHIP_ROLES, PATHWAYS } from "@/content/program";
import type { PillarKey } from "@/content/types";
import { Card, PillarMark, Empty } from "@/components/ui";
import { CheckInForm } from "@/components/CheckInForm";

export const metadata = { title: "Today" };

export default async function Dashboard() {
  const u = await requireUser("PARTICIPANT");
  const d = await loadParticipant(u.id);
  if (!d.profile?.onboardedAt) redirect("/onboarding");
  const { pack } = await getContent();
  const pillarKey = (d.profile.priorityPillar ?? d.cycle?.pillar) as PillarKey | undefined;
  const p = pillarKey ? pack.pillars.find((x) => x.key === pillarKey) : null;
  const goal = d.goals.find((g) => g.isPriority) ?? d.goals[0];
  const pos = d.cycle ? cyclePosition(d.cycle.startDate) : null;
  const week = d.cycle && pos ? cycleWeeks(d.cycle.template, pack).weeks[pos.week - 1] : null;
  const practice = practiceSummary(d.checkIns);
  const dueRels = d.relationships.slice(0, 3);
  const pathway = PATHWAYS[d.profile.pathway as keyof typeof PATHWAYS];

  const steps = [
    { done: !!d.assessment, label: "Take the FORGE self-assessment", href: "/assessment" },
    { done: !!d.profile.priorityPillar, label: "Choose your development priority", href: d.assessment ? `/assessment/${d.assessment.id}` : "/assessment" },
    { done: d.commitments.length > 0, label: "Design your Blueprint", href: "/blueprint" },
    { done: d.relationships.length > 0, label: "Name your people", href: "/network" },
    { done: !!d.cycle, label: "Start a 30-day cycle", href: "/cycle/new" },
  ];
  const remaining = steps.filter((s) => !s.done);

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">{fmt(new Date(), { weekday: "long", month: "long", day: "numeric" })} · {pathway?.name}</p>
        <h1 className="h1 mt-2">Good to see you, {u.name.split(" ")[0]}.</h1>
      </header>

      {remaining.length > 0 && (
        <Card className="bg-navy-deep border-navy-deep text-white">
          <p className="eyebrow !text-white/60">Set up your road</p>
          <ol className="mt-3 space-y-2">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className={`h-6 w-6 shrink-0 rounded-full text-xs flex items-center justify-center ${s.done ? "bg-brass text-white" : "border border-white/40"}`}>{s.done ? "✓" : i + 1}</span>
                {s.done ? <span className="text-white/60 line-through">{s.label}</span> : <Link href={s.href} className="underline underline-offset-4 decoration-brass">{s.label}</Link>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <p className="eyebrow">Where am I going?</p>
          {d.profile.destination || d.profile.forgeStatement ? (
            <p className="mt-3 font-serif text-lg leading-relaxed text-ink line-clamp-5">{d.profile.destination || d.profile.forgeStatement}</p>
          ) : (
            <p className="mt-3 muted">Your destination is not written yet. <Link className="btn-link" href="/plan">Write it</Link></p>
          )}
        </Card>

        <Card>
          <p className="eyebrow">What am I working on?</p>
          {p ? (
            <div className="mt-3">
              <div className="flex items-center gap-3">
                <PillarMark k={p.key} />
                <div>
                  <p className="h3">{p.name}</p>
                  <p className="text-sm muted">{p.short}</p>
                </div>
              </div>
              {goal?.oneMove && <p className="mt-4 text-[15px]"><span className="text-ink-mute">One move this week: </span>{goal.oneMove}</p>}
              {d.profile.eqiEnabled && d.eqi.filter((e) => e.pillar === p.key).map((e) => (
                <p key={e.id} className="mt-2 text-sm"><span className="text-ink-mute">From my EQ-i debrief: </span><Link href="/pathway/eqi" className="btn-link">{e.label}</Link></p>
              ))}
            </div>
          ) : (
            <p className="mt-3 muted">Choose a development priority after your assessment.</p>
          )}
        </Card>
      </div>

      <Card>
        <p className="eyebrow">What must I do today?</p>
        {d.cycle && week && pos ? (
          <>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
              <h2 className="h2">Day {pos.day} · {week.phase}</h2>
              <Link href="/cycle" className="text-sm btn-link">Cycle</Link>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed">{d.cycle.focus ? <><span className="font-medium">{d.cycle.focus}. </span></> : null}{week.work}</p>
            {pos.finished && <p className="mt-3 text-sm text-clay">Your 30 days are up. <Link className="btn-link" href="/cycle">Complete your Day 30 review</Link>.</p>}
          </>
        ) : (
          <p className="mt-3 muted">No active cycle. <Link className="btn-link" href="/cycle/new">Start one</Link> and you will get one specific practice each day.</p>
        )}
        <div className="mt-5 border-t border-line pt-5">
          <CheckInForm existing={d.todayCheckIn} hasCoach={d.coaches.length > 0} />
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Who is helping me?</p>
            <Link href="/network" className="text-sm btn-link">All people</Link>
          </div>
          {dueRels.length || d.coaches.length ? (
            <ul className="mt-3 divide-y divide-line">
              {d.coaches.map((c) => (
                <li key={c.id} className="py-2.5 flex justify-between gap-3"><span>{c.coach.name}</span><span className="text-sm muted">Coach (program)</span></li>
              ))}
              {dueRels.map((r) => {
                const overdue = r.nextCheckIn && daysBetween(new Date(), r.nextCheckIn) < 0;
                return (
                  <li key={r.id} className="py-2.5 flex justify-between gap-3">
                    <span>{r.name} <span className="text-sm muted">· {RELATIONSHIP_ROLES[r.role as keyof typeof RELATIONSHIP_ROLES]}</span></span>
                    <span className={`text-sm whitespace-nowrap ${overdue ? "text-clay" : "muted"}`}>{r.nextCheckIn ? `${overdue ? "Was due" : "Next"} ${fmt(r.nextCheckIn)}` : ""}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="No one added yet" href="/network" cta="Add your people">If you can't think of anyone yet, start there. It's your first design decision.</Empty>
          )}
        </Card>

        <Card>
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">How am I progressing?</p>
            <Link href="/history" className="text-sm btn-link">History</Link>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
            <Stat n={practice.practiced} label="days practiced (30d)" />
            <Stat n={d.weekly.length} label="weekly reviews" />
            <Stat n={d.relationships.reduce((n, r) => n + r.checkIns.filter((c) => c.happened).length, 0)} label="check-ins done" />
          </dl>
          <PracticeStrip checkIns={d.checkIns} />
          {d.assessment && (
            <p className="mt-4 text-sm muted">
              Latest FORGE reading: {Object.entries(scoresFrom(d.assessment)).map(([k, v]) => `${k} ${v}`).join(" · ")}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl bg-paper p-3">
      <dt className="sr-only">{label}</dt>
      <dd className="font-serif text-2xl text-navy-deep">{n}</dd>
      <p className="text-[11px] leading-tight text-ink-mute mt-1">{label}</p>
    </div>
  );
}

function PracticeStrip({ checkIns }: { checkIns: { date: string; status: string }[] }) {
  const map = new Map(checkIns.map((c) => [c.date, c.status]));
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { key, s: map.get(key) };
  });
  const tone = (s?: string) => (s === "DONE" ? "bg-navy" : s === "PARTIAL" ? "bg-brass" : s === "NOT_YET" ? "bg-line border border-ink-mute/30" : "bg-transparent border border-line");
  return (
    <div className="mt-4">
      <div className="flex gap-1" role="img" aria-label="Last 14 days of practice">
        {days.map((d) => <span key={d.key} title={`${d.key}: ${d.s ?? "no entry"}`} className={`h-5 flex-1 rounded ${tone(d.s)}`} />)}
      </div>
      <p className="mt-2 text-[11px] text-ink-mute">Last 14 days · navy done · brass partial · grey not yet. A missed day is just information.</p>
    </div>
  );
}
