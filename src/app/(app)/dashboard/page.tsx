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
import { Icon, IconBadge, type IconName } from "@/components/Icon";

export const metadata = { title: "Today" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const { setup } = await searchParams;
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
    nextSession && { key: "s", href: "/coaching", icon: "clock", text: `${fmt(nextSession.scheduledAt, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · Session with ${nextSession.coach.name.split(" (")[0]}`, side: nextSession.participantPrep ? "" : "Add prep" },
    ...openExercises.map((x) => ({ key: x.id, href: "/coaching", icon: "pencil", text: x.title, side: x.dueOn ? `Due ${fmt(x.dueOn)}` : "New" })),
    lastCommitments && { key: "c", href: "/coaching", icon: "check", text: lastCommitments.commitments, side: "Agreed" },
  ].filter(Boolean) as { key: string; href: string; icon: IconName; text: string; side: string }[];

  // The headline: the last 10 days of this cycle, or fewer early on.
  const w = pos && !pos.finished ? Math.min(10, pos.day) : 0;
  const since = w ? ymd(addDays(new Date(), -(w - 1))) : "";
  const recent = w ? d.checkIns.filter((c) => c.date >= since && (c.status === "DONE" || c.status === "PARTIAL")).length : 0;
  const head = todayHeadline({ cycle: !!(d.cycle && pos), finished: !!pos?.finished, day: pos?.day ?? 0, practiced: recent, window: w });
  const moodTone = { strong: "text-link", building: "text-ink-soft", care: "text-alert", start: "text-ink-mute", ready: "text-ink-mute", decide: "text-ink-soft" }[head.mood];
  const overdue = d.relationships.filter((r) => r.nextCheckIn && daysBetween(new Date(), r.nextCheckIn) < 0).length;

  return (
    <div className="space-y-5">
      {setup === "done" && <p role="status" className="notice">Week 1 setup is done. Your plan is on its way to the person who finds out.</p>}
      {/* Mid-cycle and not set up yet: an invitation, never a gate. */}
      {d.cycle && pos && !pos.finished && !d.cycle.setupDoneAt && (
        <Link href={`/cycle/setup?step=${d.cycle.plan ? "share" : !d.cycle.situation ? 1 : !d.cycle.feeling ? 2 : !d.cycle.oldResponse ? 3 : !d.cycle.newResponse ? 4 : !d.cycle.gap ? 5 : "plan"}`} className="tile flex items-center gap-4 transition hover:-translate-y-0.5">
          <span className="flex-1">
            <span className="block text-[15px] font-medium text-heading">Finish your week 1 setup</span>
            <span className="block text-sm text-ink-soft">Five short questions, your plan, and who finds out.</span>
          </span>
          <Icon name="arrow" className="h-4 w-4 shrink-0 text-ink-mute" />
        </Link>
      )}

      {/* The day, in one glowing card: how it's going, where you are in the 30 days, and today's check-in. */}
      <section className="glow rounded-[28px] p-5 pb-4 sm:p-7">
        <div className="flex items-baseline justify-between gap-3">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${moodTone}`}>{head.label}</p>
          <p className="text-xs text-ink-mute">{fmt(new Date(), { weekday: "short", month: "short", day: "numeric" })}</p>
        </div>
        <h1 className="mt-2 font-serif text-[32px] sm:text-[40px] leading-[1.05] tracking-[-0.02em] text-heading">{head.title}</h1>
        <p className="mt-1.5 text-[15px] text-ink-soft max-w-md">{head.line}</p>

        {d.cycle && week && pos ? (
          <>
            <DayArc day={pos.day} pillar={d.cycle.pillar as PillarKey} />
            <p className="text-center text-[11px] uppercase tracking-[0.14em] text-ink-mute">Week {pos.week} · {week.phase}{d.cycle.seasonMonth ? ` · Month ${d.cycle.seasonMonth} of 3` : ""}</p>
            <Link href="/cycle" className="mt-1 block text-center text-[17px] font-medium leading-snug text-ink">{d.cycle.plan || d.cycle.focus || week.work}</Link>
            {pos.finished
              ? <Link href="/cycle" className="mt-5 btn-primary w-full">Open my day 30 review</Link>
              : <div className="mt-4"><CheckInForm existing={d.todayCheckIn} hasCoach={d.coaches.length > 0} identityLevel={d.identity?.level} /></div>}
          </>
        ) : (
          <Link href="/start" className="mt-6 btn-primary w-full">Pick up where I left off</Link>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Tile href="/history" icon="calendar" label="Practiced" value={String(practice.practiced)} word={practice.practiced ? "in the last 30 days" : "none yet"}>
          <PracticeStrip checkIns={d.checkIns} pillar={(d.cycle?.pillar ?? pillarKey ?? "F") as PillarKey} />
        </Tile>
        <Tile href="/network" icon="people" label="People" value={String(dueSoon.length)} word={overdue ? `${overdue} overdue` : dueSoon.length ? "due soon" : d.relationships.length ? "all caught up" : "add someone"} tone={overdue ? "text-alert" : "text-ink-mute"} />

        {/* Who I am: the anchor of the day, set like a page from the book. */}
        <Link href="/identity" className="glow col-span-2 block rounded-[22px] p-5 sm:p-6 transition hover:-translate-y-0.5">
          <p className="flex items-center justify-between eyebrow !text-gold">{d.identity?.role ? `Who's behind the wheel · as ${withArticle(d.identity.role)}` : "Who's behind the wheel"}<Icon name="arrow" className="h-4 w-4 text-ink-mute" /></p>
          <p className="mt-3 font-serif text-[21px] sm:text-[23px] leading-[1.3] tracking-[-0.01em] text-heading line-clamp-4">
            <span aria-hidden className="mr-1 gold-text">&ldquo;</span>{statement || "Claim who you are."}
          </p>
          {d.identity?.level === "REINVENT" && d.identity.personaName && <p className="mt-3 text-xs text-ink-mute">Performance identity: <span className="text-ink">{d.identity.personaName}</span></p>}
        </Link>

        <Link href={goal?.oneMove ? "/road#one-move" : "/road"} className="tile col-span-2 flex items-center gap-4 transition hover:-translate-y-0.5">
          {p ? <PillarMark k={p.key} /> : <IconBadge name="step" />}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-ink-mute">My move this week{p ? ` · ${p.name}` : ""}</p>
            <p className="mt-0.5 text-[15px] font-medium leading-snug text-ink line-clamp-2">{goal?.oneMove || "Pick one move"}</p>
          </div>
          <Icon name="arrow" className="h-4 w-4 shrink-0 text-ink-mute" />
        </Link>
      </div>

      {coachItems.length > 0 && (
        <section className="tile !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <p className="eyebrow">From your coach</p>
            <Link href="/coaching" className="text-sm btn-link">Open</Link>
          </div>
          <ul>
            {coachItems.map((x) => (
              <li key={x.key} className="border-t border-line/50 first:border-t-0">
                <Link href={x.href} className="flex items-center gap-3 px-5 py-3 transition hover:bg-ink/[0.03]">
                  <IconBadge name={x.icon} className="!h-8 !w-8" />
                  <span className="flex-1 text-[15px] line-clamp-1">{x.text}</span>
                  {x.side && <span className="chip whitespace-nowrap">{x.side}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** A soft tile: an icon, a label, one big number and a word. Tapping opens the detail. */
function Tile({ href, icon, label, value, word, tone = "text-ink-mute", children }: { href: string; icon: IconName; label: string; value?: string; word?: string; tone?: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="tile block transition hover:-translate-y-0.5">
      <p className="flex items-center gap-2.5 text-[13px] text-ink-soft"><IconBadge name={icon} className="!h-7 !w-7 [&>svg]:!h-4 [&>svg]:!w-4" />{label}<Icon name="arrow" className="ml-auto h-4 w-4 text-ink-mute" /></p>
      {value !== undefined && <p className="mt-4 font-serif text-[44px] leading-none tracking-[-0.02em] text-heading">{value}</p>}
      {word && <p className={`mt-1.5 text-[13px] ${tone}`}>{word}</p>}
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
  const tone = (s?: string) => (s === "DONE" ? PILLAR_FILL[pillar].full : s === "PARTIAL" ? PILLAR_FILL[pillar].part : s === "NOT_YET" ? "bg-ink/[0.14]" : "bg-ink/[0.06]");
  return (
    <div className="mt-3">
      <div className="flex gap-1" role="img" aria-label="Last 14 days of practice">
        {days.map((d) => <span key={d.key} title={`${d.key}: ${d.s ?? "no entry"}`} className={`h-3.5 flex-1 rounded-[4px] ${tone(d.s)}`} />)}
      </div>
    </div>
  );
}
