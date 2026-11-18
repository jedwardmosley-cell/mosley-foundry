import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadParticipant } from "@/lib/participant";
import { getContent } from "@/content";
import { cycleWeeks, cyclePosition } from "@/lib/cycle";
import { fmt, daysBetween } from "@/lib/dates";
import { todayHeadline } from "@/lib/todayHeadline";
import { getJourney, JOURNEY_STEPS } from "@/lib/journey";
import { withArticle } from "@/content/whoIAm";
import type { PillarKey } from "@/content/types";
import { PillarMark } from "@/components/ui";
import { CheckInForm, type CheckInFocus } from "@/components/CheckInForm";
import { CenterLine } from "@/components/CenterLine";
import { TimezoneSync } from "@/components/Timezone";
import { focusTitle, MAX_FOCUSES } from "@/lib/focus";
import { Icon, IconBadge, type IconName } from "@/components/Icon";

export const metadata = { title: "The Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ setup?: string; checked?: string }> }) {
  const { setup, checked } = await searchParams;
  const u = await requireUser("PARTICIPANT");
  const [d, journey] = await Promise.all([loadParticipant(u.id), getJourney(u.id)]);
  if (!d.profile?.onboardedAt) redirect("/onboarding");
  // The daily check-in opens once the whole kickoff is done: who, where, the focus and a routine.
  const kickoffStep = journey.current ? JOURNEY_STEPS.findIndex((s) => s.key === journey.current) + 1 : 0;
  const kickoff = kickoffStep ? JOURNEY_STEPS[kickoffStep - 1] : null;
  const { pack } = await getContent();
  const pillarKey = (d.profile.priorityPillar ?? d.cycle?.pillar) as PillarKey | undefined;
  const p = pillarKey ? pack.pillars.find((x) => x.key === pillarKey) : null;
  // Today's check-in: every focus still in its 30 days, with equal weight, and one save for the day.
  const inProgress: CheckInFocus[] = d.focuses
    .map((f) => ({ f, p: cyclePosition(f.startDate) }))
    .filter(({ p }) => !p.finished)
    .map(({ f, p }) => ({ slot: (f.slot === 2 ? 2 : 1) as 1 | 2, id: f.id, title: focusTitle(f), plan: f.plan, day: p.day, pillar: f.pillar, status: !d.todayCheckIn ? "" : f.slot === 2 ? d.todayCheckIn.status2 : d.todayCheckIn.status }));
  const finishedFocuses = d.focuses.filter((f) => cyclePosition(f.startDate).finished);
  // With one focus in progress, Today shows its 30 days as an arc.
  const solo = inProgress.length === 1 ? d.focuses.find((f) => f.id === inProgress[0].id) ?? null : null;
  const soloPos = solo ? cyclePosition(solo.startDate) : null;
  const notSetUp = d.focuses.find((f) => !f.setupDoneAt) ?? null;
  const pos = d.cycle ? cyclePosition(d.cycle.startDate) : null;
  const week = d.cycle && pos ? cycleWeeks(d.cycle.template, pack).weeks[pos.week - 1] : null;

  // Items the coach has put in front of this person. They live on the Coaching page; this makes them hard to miss.
  const now = new Date();
  const openExercises = d.exercises.filter((x) => x.status !== "DONE").slice(0, 5);
  const nextSession = [...d.sessions].reverse().find((x) => x.scheduledAt >= now) ?? null;
  const lastCommitments = d.sessions.find((x) => x.scheduledAt < now && x.commitments) ?? null;


  const statement = d.profile.forgeStatement || d.identity?.becoming || d.profile.destination || "";
  const dueSoon = d.relationships.filter((r) => r.nextCheckIn && daysBetween(new Date(), r.nextCheckIn) <= 2).slice(0, 3);
  const coachItems = [
    nextSession && { key: "s", href: "/coaching", icon: "clock", text: `${fmt(nextSession.scheduledAt, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}: session with ${nextSession.coach.name.split(" (")[0]}`, side: nextSession.participantPrep ? "" : "Add prep" },
    ...openExercises.map((x) => ({ key: x.id, href: "/coaching", icon: "pencil", text: x.title, side: x.dueOn ? `Due ${fmt(x.dueOn)}` : "New" })),
    lastCommitments && { key: "c", href: "/coaching", icon: "check", text: lastCommitments.commitments, side: "Agreed" },
  ].filter(Boolean) as { key: string; href: string; icon: IconName; text: string; side: string }[];

  const head = todayHeadline({ cycle: !!(d.cycle && pos), finished: !!pos?.finished, day: pos?.day ?? 0 });
  // Two focuses: each shows its own day below, so the headline belongs to neither.
  if (!kickoffStep && inProgress.length > 1) Object.assign(head, { title: "Today.", line: "Practice your plans, then check in. A few taps is enough." });
  if (kickoffStep) Object.assign(head, { mood: "start", label: `Getting in the Driver's Seat, step ${kickoffStep} of 4`, title: "Build your system first", line: kickoff?.key === "road" && journey.roadMissing.length ? `Still needed: ${journey.roadMissing.join(", ")}. Your daily check-in opens once your system is set up.` : "Your daily check-in opens once your system is set up." });
  const moodTone = { start: "text-ink-mute", ready: "text-ink-mute", decide: "text-ink-soft" }[head.mood];
  const overdue = d.relationships.filter((r) => r.nextCheckIn && daysBetween(new Date(), r.nextCheckIn) < 0).length;

  return (
    <div className="space-y-5">
      <TimezoneSync saved={d.profile.timezone} />
      {setup === "done" && <p role="status" className="notice">Your focus is set up. Your plan is on its way to the person who finds out.</p>}
      {/* Mid-cycle and not set up yet: an invitation. During the kickoff the card below says it instead. */}
      {!kickoff && notSetUp && !cyclePosition(notSetUp.startDate).finished && (
        <Link href={`/cycle/setup?step=${notSetUp.plan ? "share" : !notSetUp.situation ? 1 : !notSetUp.feeling ? 2 : !notSetUp.oldResponse ? 3 : !notSetUp.newResponse ? 4 : !notSetUp.gap ? 5 : "plan"}`} className="tile flex items-center gap-4 transition hover:-translate-y-0.5">
          <span className="flex-1">
            <span className="block text-[15px] font-medium text-heading">Finish setting up {d.focuses.length > 1 ? `"${focusTitle(notSetUp)}"` : "your focus"}</span>
            <span className="block text-sm text-ink-soft">Five short questions, your plan, and who finds out.</span>
          </span>
          <Icon name="arrow" className="h-4 w-4 shrink-0 text-ink-mute" />
        </Link>
      )}

      {/* The day: the headline on the ground, the center line under it, and only the check-in in a card. */}
      <section aria-label="Today" className="space-y-4">
        <div>
          <p className="flex items-baseline justify-between gap-3 text-[13px] font-bold text-ink-mute"><span className={moodTone}>{head.label}</span><span className="font-normal">{fmt(new Date(), { weekday: "short", month: "short", day: "numeric" })}</span></p>
          <h1 className="mt-1 text-[36px] sm:text-[44px] font-extrabold leading-[1.02] tracking-[-0.02em] text-heading">{head.title}</h1>
          <p className="mt-2 text-[16px] text-ink-soft max-w-md">{head.line}</p>
        </div>

        {kickoff ? (
          <div className="card">
            <ol className="space-y-2.5">
              {JOURNEY_STEPS.map((s, i) => (
                <li key={s.key} className={`flex items-center gap-3 text-[16px] ${journey.done[s.key] ? "text-ink-mute" : s.key === kickoff.key ? "font-bold text-heading" : "text-ink-soft"}`}>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${journey.done[s.key] ? "bg-navy text-white" : s.key === kickoff.key ? "bg-lane text-ink" : "border border-ink/20"}`}>{journey.done[s.key] ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}</span>
                  {s.label}{journey.done[s.key] && <span className="sr-only"> (done)</span>}
                </li>
              ))}
            </ol>
            <Link href={`/start?step=${kickoffStep}`} className="mt-5 btn-primary w-full">Next: {kickoff.next}</Link>
          </div>
        ) : d.cycle && week && pos ? (
          <>
            {/* One focus: its 30 days as the center line. Two focuses: each gets its own line inside the check-in, with equal weight. */}
            {solo && soloPos && (
              <div className="space-y-2.5">
                <CenterLine start={solo.startDate} day={soloPos.day} cycleId={solo.id} rows={d.checkIns} justSaved={!!checked} label="My 30 days" />
                <p className="text-[14px] text-ink-mute">Week {soloPos.week}: {cycleWeeks(solo.template, pack).weeks[soloPos.week - 1]?.phase.toLowerCase()}{solo.seasonMonth ? `, month ${solo.seasonMonth} of 3` : ""}</p>
                <Link href={`/cycle?id=${solo.id}`} className="flex items-start gap-2.5 text-[18px] font-bold leading-snug text-heading hover:text-link"><PillarMark k={solo.pillar as PillarKey} size="sm" />{focusTitle(solo)}</Link>
                {solo.title && solo.plan && <p className="font-serif text-[17px] text-ink-soft">{solo.plan}</p>}
              </div>
            )}
            {inProgress.length > 0 && (
              <div className="card">
                <CheckInForm existing={d.todayCheckIn} hasCoach={d.coaches.length > 0} identityLevel={d.identity?.level} focuses={inProgress}
                  lines={inProgress.length > 1 ? Object.fromEntries(inProgress.map((f) => {
                    const c = d.focuses.find((x) => x.id === f.id)!;
                    return [f.id, <CenterLine key={f.id} compact start={c.startDate} day={f.day} cycleId={f.id} rows={d.checkIns} justSaved={!!checked} label={focusTitle(c)} />];
                  })) : undefined} />
              </div>
            )}
            {finishedFocuses.map((f) => (
              <Link key={f.id} href={`/cycle?id=${f.id}`} className="btn-primary w-full">Open my day 30 review{d.focuses.length > 1 ? `: ${focusTitle(f)}` : ""}</Link>
            ))}
          </>
        ) : (
          <Link href="/start" className="btn-primary w-full">Pick up where I left off</Link>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        {/* No practice count on Today: calm, not gamified. The day-by-day record is on the 30 days page. */}
        <Tile className="col-span-2" href="/network" icon="people" label="People" value={String(dueSoon.length)} word={overdue ? `${overdue} overdue` : dueSoon.length ? "due soon" : d.relationships.length ? "all caught up" : "add someone"} tone={overdue ? "text-alert" : "text-ink-mute"} />

        {/* Who I am: the anchor of the day, set like a page from the book. */}
        <Link href="/identity" className="glow col-span-2 block rounded-[22px] p-5 sm:p-6 transition hover:-translate-y-0.5">
          <p className="flex items-center justify-between eyebrow !text-gold">{d.identity?.role ? `In the driver's seat, as ${withArticle(d.identity.role)}` : "The Driver's Seat"}<Icon name="arrow" className="h-4 w-4 text-ink-mute" /></p>
          <p className="mt-3 font-serif text-[21px] sm:text-[23px] leading-[1.3] tracking-[-0.01em] text-heading line-clamp-4">
            <span aria-hidden className="mr-1 gold-text">&ldquo;</span>{statement || "Claim who you are."}
          </p>
          {d.identity?.level === "REINVENT" && d.identity.personaName && <p className="mt-3 text-xs text-ink-mute">Performance identity: <span className="text-ink">{d.identity.personaName}</span></p>}
        </Link>

        <Link href="/focus" className="tile col-span-2 flex items-center gap-4 transition hover:-translate-y-0.5">
          {p ? <PillarMark k={p.key} /> : <IconBadge name="step" />}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-ink-mute">The Windshield</p>
            <p className="mt-0.5 text-[15px] font-medium leading-snug text-ink line-clamp-2">
              {d.focuses.length === 0 ? "Choose one or two things to work on" : d.focuses.length < MAX_FOCUSES ? "One focus in progress. There's room for one more, if you want it." : "Two focuses in progress. That's the most."}
            </p>
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
function Tile({ href, icon, label, value, word, tone = "text-ink-mute", children, className = "" }: { className?: string; href: string; icon: IconName; label: string; value?: string; word?: string; tone?: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className={`tile block transition hover:-translate-y-0.5 ${className}`}>
      <p className="flex items-center gap-2.5 text-[13px] text-ink-soft"><IconBadge name={icon} className="!h-7 !w-7 [&>svg]:!h-4 [&>svg]:!w-4" />{label}<Icon name="arrow" className="ml-auto h-4 w-4 text-ink-mute" /></p>
      {value !== undefined && <p className="mt-4 font-serif text-[44px] leading-none tracking-[-0.02em] text-heading">{value}</p>}
      {word && <p className={`mt-1.5 text-[13px] ${tone}`}>{word}</p>}
      {children}
    </Link>
  );
}


