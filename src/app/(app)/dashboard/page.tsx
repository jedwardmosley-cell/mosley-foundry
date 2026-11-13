import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadParticipant } from "@/lib/participant";
import { getContent } from "@/content";
import { cycleWeeks, cyclePosition, practiceSummary } from "@/lib/cycle";
import { fmt, daysBetween, ymd, addDays } from "@/lib/dates";
import { todayHeadline } from "@/lib/todayHeadline";
import { withArticle } from "@/content/whoIAm";
import type { PillarKey } from "@/content/types";
import { PillarMark, PILLAR_FILL } from "@/components/ui";
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


  const statement = d.profile.forgeStatement || d.identity?.becoming || d.profile.destination || "";
  const dueSoon = d.relationships.filter((r) => r.nextCheckIn && daysBetween(new Date(), r.nextCheckIn) <= 2).slice(0, 3);
  const coachItems = [
    nextSession && { key: "s", href: "/coaching", icon: "◷", text: `${fmt(nextSession.scheduledAt, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · Session with ${nextSession.coach.name.split(" (")[0]}`, side: nextSession.participantPrep ? "" : "Add prep" },
    ...openExercises.map((x) => ({ key: x.id, href: "/coaching", icon: "✎", text: x.title, side: x.dueOn ? `Due ${fmt(x.dueOn)}` : "New" })),
    lastCommitments && { key: "c", href: "/coaching", icon: "✓", text: lastCommitments.commitments, side: "Agreed" },
  ].filter(Boolean) as { key: string; href: string; icon: string; text: string; side: string }[];

  // The headline: the last 10 days of this cycle, or fewer early on.
  const w = pos && !pos.finished ? Math.min(10, pos.day) : 0;
  const since = w ? ymd(addDays(new Date(), -(w - 1))) : "";
  const recent = w ? d.checkIns.filter((c) => c.date >= since && (c.status === "DONE" || c.status === "PARTIAL")).length : 0;
  const head = todayHeadline({ cycle: !!(d.cycle && pos), finished: !!pos?.finished, day: pos?.day ?? 0, practiced: recent, window: w });
  const moodTone = { strong: "text-link", building: "text-ink-soft", care: "text-alert", start: "text-ink-mute", ready: "text-ink-mute", decide: "text-ink-soft" }[head.mood];
  const overdue = d.relationships.filter((r) => r.nextCheckIn && daysBetween(new Date(), r.nextCheckIn) < 0).length;

  return (
    <div className="space-y-5">

      {/* The day, in one glowing card: how it's going, where you are in the 30 days, and today's check-in. */}
      <section className="glow rounded-[28px] p-5 pb-4 sm:p-7">
        <div className="flex items-baseline justify-between gap-3">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${moodTone}`}>{head.label}</p>
          <p className="text-xs text-ink-mute">{fmt(new Date(), { weekday: "short", month: "short", day: "numeric" })}</p>
        </div>
        <h1 className="mt-1.5 font-serif text-[28px] sm:text-[34px] leading-[1.1] text-heading">{head.title}</h1>
        <p className="mt-1.5 text-[15px] text-ink-soft max-w-md">{head.line}</p>

        {d.cycle && week && pos ? (
          <>
            <DayArc day={pos.day} pillar={d.cycle.pillar as PillarKey} />
            <p className="text-center text-[11px] uppercase tracking-[0.14em] text-ink-mute">Week {pos.week} · {week.phase}{d.cycle.seasonMonth ? ` · Month ${d.cycle.seasonMonth} of 3` : ""}</p>
            <Link href="/cycle" className="mt-1 block text-center text-[17px] font-medium leading-snug text-ink">{d.cycle.focus || week.work}</Link>
            {pos.finished
              ? <Link href="/cycle" className="mt-5 btn-primary w-full">Open my day 30 review</Link>
              : <div className="mt-4"><CheckInForm existing={d.todayCheckIn} hasCoach={d.coaches.length > 0} identityLevel={d.identity?.level} /></div>}
          </>
        ) : (
          <Link href="/start" className="mt-6 btn-primary w-full">Pick up where I left off</Link>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Tile href="/history" label="Days practiced" value={String(practice.practiced)} word={practice.practiced ? "last 30 days" : "none yet"}>
          <PracticeStrip checkIns={d.checkIns} pillar={(d.cycle?.pillar ?? pillarKey ?? "F") as PillarKey} />
        </Tile>
        <Tile href="/network" label="People" value={String(dueSoon.length)} word={overdue ? `${overdue} overdue` : dueSoon.length ? "due soon" : d.relationships.length ? "all caught up" : "add someone"} tone={overdue ? "text-alert" : "text-link"} />
        <Tile href="/identity" label={d.identity?.role ? `Who I am · as ${withArticle(d.identity.role)}` : "Who I am"} wide>
          <p className="mt-2 font-serif text-[17px] leading-snug text-heading line-clamp-3">{statement || "Claim who you are."}</p>
          {d.identity?.level === "REINVENT" && d.identity.personaName && <p className="mt-1.5 text-xs text-ink-mute">Performance identity: <span className="text-ink">{d.identity.personaName}</span></p>}
        </Tile>
        <Tile href={goal?.oneMove ? "/blueprint#one-move" : "/blueprint"} label="This week" wide>
          <p className="mt-2 text-[15px] leading-snug line-clamp-2">{goal?.oneMove || "Pick one move"}</p>
          {p && <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-mute"><PillarMark k={p.key} size="sm" /> {p.name}</p>}
        </Tile>
      </div>

      {coachItems.length > 0 && (
        <section className="tile !p-0">
          <div className="flex items-center justify-between px-5 pt-4">
            <p className="eyebrow">From your coach</p>
            <Link href="/coaching" className="text-sm btn-link">Open</Link>
          </div>
          <ul className="mt-2 divide-y divide-line/60">
            {coachItems.map((x) => (
              <li key={x.key}>
                <Link href={x.href} className="flex items-center gap-3 px-5 py-3 hover:bg-paper/60">
                  <span aria-hidden className="w-5 text-center text-ink-mute">{x.icon}</span>
                  <span className="flex-1 text-[15px] line-clamp-1">{x.text}</span>
                  {x.side && <span className="text-xs text-ink-mute whitespace-nowrap">{x.side}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** A soft tile: a label, one big number and one word, or a short line. Tapping opens the detail. */
function Tile({ href, label, value, word, tone = "text-ink-mute", wide = false, children }: { href: string; label: string; value?: string; word?: string; tone?: string; wide?: boolean; children?: React.ReactNode }) {
  return (
    <Link href={href} className={`tile block hover:-translate-y-0.5 transition-transform ${wide ? "col-span-2 sm:col-span-1" : ""}`}>
      <p className="flex items-center justify-between text-[13px] text-ink-soft">{label}<span aria-hidden className="text-ink-mute">›</span></p>
      {value !== undefined && <p className="mt-3 font-serif text-[40px] leading-none text-heading">{value}</p>}
      {word && <p className={`mt-1 text-sm ${tone}`}>{word}</p>}
      {children}
    </Link>
  );
}

/** The 30 days as an arc, with today marked. */
function DayArc({ day, pillar }: { day: number; pillar: PillarKey }) {
  const color = `rgb(var(${PILLAR_FILL[pillar].cssVar}))`;
  const r = 120, cx = 150, cy = 140;
  const t = Math.min(Math.max(day / 30, 0), 1);
  const a = Math.PI * (1 - t);
  const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
  const arc = (to: number) => { const e = Math.PI * (1 - to); return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(e)} ${cy - r * Math.sin(e)}`; };
  return (
    <div className="relative mx-auto mt-3 w-full max-w-[210px]">
      <svg viewBox="0 0 300 150" className="w-full" aria-hidden>
        <defs>
          <linearGradient id="arc" x1="0" x2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.35" />
            <stop offset="1" stopColor={color} />
          </linearGradient>
        </defs>
        <path d={arc(1)} fill="none" stroke="rgb(var(--ink-mute) / 0.25)" strokeWidth="3" strokeLinecap="round" />
        <path d={arc(t)} fill="none" stroke="url(#arc)" strokeWidth="4" strokeLinecap="round" />
        <circle cx={x} cy={y} r="7" fill="rgb(var(--card))" stroke={color} strokeWidth="3" />
      </svg>
      <div className="absolute inset-x-0 bottom-2 text-center">
        <p className="font-serif text-[38px] leading-none text-heading">{day}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-ink-mute">of 30</p>
      </div>
    </div>
  );
}

function PracticeStrip({ checkIns, pillar }: { checkIns: { date: string; status: string }[]; pillar: PillarKey }) {
  const map = new Map(checkIns.map((c) => [c.date, c.status]));
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { key, s: map.get(key) };
  });
  const tone = (s?: string) => (s === "DONE" ? PILLAR_FILL[pillar].full : s === "PARTIAL" ? PILLAR_FILL[pillar].part : s === "NOT_YET" ? "bg-line border border-ink-mute/30" : "bg-transparent border border-line");
  return (
    <div className="mt-3">
      <div className="flex gap-1" role="img" aria-label="Last 14 days of practice">
        {days.map((d) => <span key={d.key} title={`${d.key}: ${d.s ?? "no entry"}`} className={`h-3 flex-1 rounded-sm ${tone(d.s)}`} />)}
      </div>
    </div>
  );
}
