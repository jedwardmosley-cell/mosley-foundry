import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadParticipant } from "@/lib/participant";
import { getContent } from "@/content";
import { cycleWeeks, cyclePosition, practiceSummary } from "@/lib/cycle";
import { fmt, daysBetween } from "@/lib/dates";
import type { PillarKey } from "@/content/types";
import { Card, PillarMark } from "@/components/ui";
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

  // Items the coach has put in front of this person. They live on the Coaching page; this makes them hard to miss.
  const now = new Date();
  const openExercises = d.exercises.filter((x) => x.status !== "DONE").slice(0, 5);
  const nextSession = [...d.sessions].reverse().find((x) => x.scheduledAt >= now) ?? null;
  const lastCommitments = d.sessions.find((x) => x.scheduledAt < now && x.commitments) ?? null;


  const statement = d.identity?.becoming || d.profile.destination || "";
  const dueSoon = d.relationships.filter((r) => r.nextCheckIn && daysBetween(new Date(), r.nextCheckIn) <= 2).slice(0, 3);
  const coachItems = [
    nextSession && { key: "s", href: "/coaching", icon: "◷", text: `${fmt(nextSession.scheduledAt, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · Session with ${nextSession.coach.name.split(" (")[0]}`, side: nextSession.participantPrep ? "" : "Add prep" },
    ...openExercises.map((x) => ({ key: x.id, href: "/coaching", icon: "✎", text: x.title, side: x.dueOn ? `Due ${fmt(x.dueOn)}` : "New" })),
    lastCommitments && { key: "c", href: "/coaching", icon: "✓", text: lastCommitments.commitments, side: "Agreed" },
  ].filter(Boolean) as { key: string; href: string; icon: string; text: string; side: string }[];

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="h2">Hi, {u.name.split(" ")[0]}</h1>
        <p className="text-sm text-ink-mute">{fmt(new Date(), { weekday: "short", month: "short", day: "numeric" })}</p>
      </header>

      {/* The one thing to do today */}
      <section className="rounded-2xl bg-navy-deep p-5 text-white shadow-sm">
        {statement && (
          <Link href={d.identity ? "/identity" : "/plan"} className="block font-serif text-[19px] leading-snug line-clamp-2 hover:text-brass-soft">{statement}</Link>
        )}
        {d.identity?.level === "REINVENT" && d.identity.personaName && (
          <p className="mt-1.5 text-sm text-white/70">Performance identity: <span className="text-white">{d.identity.personaName}</span></p>
        )}
        {d.cycle && week && pos ? (
          <>
            <div className={`${statement ? "mt-4 border-t border-white/15 pt-4" : ""} flex items-center justify-between gap-3`}>
              <p className="text-xs uppercase tracking-[0.14em] text-white/60">Day {pos.day} of 30{d.cycle.seasonMonth ? ` · Month ${d.cycle.seasonMonth} of 3` : ""} · {week.phase}</p>
              {p && <PillarMark k={p.key} size="sm" />}
            </div>
            <Link href="/cycle" className="mt-1.5 block text-xl font-medium leading-snug">{d.cycle.focus || week.work}</Link>
            {pos.finished
              ? <Link href="/cycle" className="mt-4 btn w-full bg-brass text-navy-deep hover:bg-white">Open my day 30 review</Link>
              : <div className="mt-4"><CheckInForm existing={d.todayCheckIn} hasCoach={d.coaches.length > 0} identityLevel={d.identity?.level} dark /></div>}
          </>
        ) : (
          <div className={statement ? "mt-4 border-t border-white/15 pt-4" : ""}>
            <p className="text-xl font-medium">Start your 30 days</p>
            <Link href="/start" className="mt-4 btn w-full bg-brass text-navy-deep hover:bg-white">Pick up where I left off</Link>
          </div>
        )}
      </section>

      {coachItems.length > 0 && (
        <Card className="!p-0">
          <div className="flex items-center justify-between px-5 pt-4">
            <p className="eyebrow">From your coach</p>
            <Link href="/coaching" className="text-sm btn-link">Open</Link>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {coachItems.map((x) => (
              <li key={x.key}>
                <Link href={x.href} className="flex items-center gap-3 px-5 py-3 hover:bg-paper">
                  <span aria-hidden className="w-5 text-center text-brass">{x.icon}</span>
                  <span className="flex-1 text-[15px] line-clamp-1">{x.text}</span>
                  {x.side && <span className="text-xs text-ink-mute whitespace-nowrap">{x.side}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <p className="eyebrow">Last 14 days</p>
          <Link href="/history" className="text-sm btn-link">History</Link>
        </div>
        <PracticeStrip checkIns={d.checkIns} />
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat n={practice.practiced} label="days practiced" />
          <Stat n={d.weekly.length} label="weekly reviews" />
          <Stat n={d.relationships.reduce((n, r) => n + r.checkIns.filter((c) => c.happened).length, 0)} label="people check-ins" />
        </dl>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/network" className="card block hover:border-navy/40">
          <p className="eyebrow">People</p>
          {dueSoon.length ? (
            <ul className="mt-2 space-y-1">
              {dueSoon.map((r) => {
                const overdue = daysBetween(new Date(), r.nextCheckIn!) < 0;
                return <li key={r.id} className="flex justify-between gap-2 text-[15px]"><span>{r.name.split(" (")[0]}</span><span className={`text-xs ${overdue ? "text-clay" : "text-ink-mute"}`}>{overdue ? "Overdue" : "Due"}</span></li>;
              })}
            </ul>
          ) : <p className="mt-2 text-[15px] text-ink-soft">{d.relationships.length ? "All caught up" : "Add your first person"}</p>}
        </Link>
        <Link href={goal?.oneMove ? "/blueprint#one-move" : "/blueprint"} className="card block hover:border-navy/40">
          <p className="eyebrow">This week</p>
          <p className="mt-2 text-[15px] line-clamp-2">{goal?.oneMove || "Pick one move"}</p>
        </Link>
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
    <div className="mt-3">
      <div className="flex gap-1" role="img" aria-label="Last 14 days of practice">
        {days.map((d) => <span key={d.key} title={`${d.key}: ${d.s ?? "no entry"}`} className={`h-5 flex-1 rounded ${tone(d.s)}`} />)}
      </div>
      <div className="mt-2 flex gap-4 text-[11px] text-ink-mute"><span><span className="inline-block h-2 w-2 rounded-sm bg-navy mr-1" />Done</span><span><span className="inline-block h-2 w-2 rounded-sm bg-brass mr-1" />Partial</span><span><span className="inline-block h-2 w-2 rounded-sm bg-line mr-1" />Not yet</span></div>
    </div>
  );
}
