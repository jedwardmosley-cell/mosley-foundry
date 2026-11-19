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
import { CheckInForm, type CheckInFocus } from "@/components/CheckInForm";
import { CenterLine } from "@/components/CenterLine";
import { TimezoneSync } from "@/components/Timezone";
import { focusTitle, MAX_FOCUSES } from "@/lib/focus";
import { Icon, type IconName } from "@/components/Icon";

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

  // Chapter pages: the day written out the way the book writes its chapters.
  const dayTitle = kickoffStep ? head.title : solo && soloPos ? `Day ${numberWord(soloPos.day)}` : inProgress.length > 1 ? "Today" : head.title;
  const focusName = solo ? focusTitle(solo) : "";
  const weekLine = solo && soloPos ? `Week ${numberWord(soloPos.week).toLowerCase()}: ${cycleWeeks(solo.template, pack).weeks[soloPos.week - 1]?.phase.toLowerCase() ?? ""}${solo.seasonMonth ? `, month ${solo.seasonMonth} of 3` : ""}` : "";

  return (
    <div>
      <TimezoneSync saved={d.profile.timezone} />
      {setup === "done" && <p role="status" className="notice mb-5">Your focus is set up. Your plan is on its way to the person who finds out.</p>}
      {/* Mid-cycle and not set up yet: an invitation. During the kickoff the page below says it instead. */}
      {!kickoff && notSetUp && !cyclePosition(notSetUp.startDate).finished && (
        <Link href={`/cycle/setup?step=${notSetUp.plan ? "share" : !notSetUp.situation ? 1 : !notSetUp.feeling ? 2 : !notSetUp.oldResponse ? 3 : !notSetUp.newResponse ? 4 : !notSetUp.gap ? 5 : "plan"}`} className="mb-6 flex items-center gap-4 border-y border-line/70 py-3 transition hover:text-link">
          <span className="flex-1">
            <span className="block font-book text-[19px] text-heading">Finish setting up {d.focuses.length > 1 ? `"${focusTitle(notSetUp)}"` : "your focus"}</span>
            <span className="block text-sm text-ink-soft">Five short questions, your plan, and who finds out.</span>
          </span>
          <Icon name="arrow" className="h-4 w-4 shrink-0 text-ink-mute" />
        </Link>
      )}

      {/* The day, set like a chapter opening: running head, the day, the road ahead, the title, then the check-in. */}
      <section aria-label="Today">
        <p className="text-center text-[12px] text-ink-mute">both hands on the wheel</p>
        <p className="mt-4 flex items-baseline justify-between gap-3">
          <span className="font-book text-[30px] sm:text-[34px] leading-none text-heading">{dayTitle}</span>
          <span className="text-[13px] text-ink-mute">{fmt(new Date(), { weekday: "short", month: "short", day: "numeric" })}</span>
        </p>
        <div className="mt-4 -mx-4 sm:mx-0 aspect-[16/9] bg-ink/10 bg-cover bg-center grayscale" style={{ backgroundImage: "url(/chapters/road-ahead.jpg)" }} role="img" aria-label="The road ahead, from behind the wheel" />

        {kickoff ? (
          <div className="mt-6">
            <p className="font-book italic text-[18px] text-ink-soft">{head.line}</p>
            <ol className="mt-5 divide-y divide-line/60 border-y border-line/60">
              {JOURNEY_STEPS.map((s, i) => (
                <li key={s.key} className={`flex items-baseline gap-4 py-3 ${journey.done[s.key] ? "text-ink-mute" : s.key === kickoff.key ? "text-heading" : "text-ink-soft"}`}>
                  <span className="w-5 shrink-0 font-book text-[17px]">{journey.done[s.key] ? <Icon name="check" className="h-4 w-4" /> : i + 1}</span>
                  <span className={`font-book text-[20px] ${s.key === kickoff.key ? "border-b-2 border-gold" : ""}`}>{s.label}</span>
                  {journey.done[s.key] && <span className="sr-only"> (done)</span>}
                </li>
              ))}
            </ol>
            <Link href={`/start?step=${kickoffStep}`} className="mt-6 btn-primary w-full">Next: {kickoff.next}</Link>
          </div>
        ) : d.cycle && week && pos ? (
          <>
            {solo && soloPos && (
              <div className="mt-5">
                <Link href={`/cycle?id=${solo.id}`} className={`block font-book text-heading hover:text-link ${focusName.length <= 48 ? "uppercase text-[26px] leading-[1.1] tracking-[0.01em]" : "text-[24px] leading-tight"}`}>{focusName}</Link>
                <p className="mt-2 font-book italic text-[18px] text-ink-soft">{solo.title && solo.plan ? solo.plan : weekLine}</p>
                <div className="mt-5"><CenterLine start={solo.startDate} day={soloPos.day} cycleId={solo.id} rows={d.checkIns} justSaved={!!checked} label="My 30 days" /></div>
                {solo.title && solo.plan && <p className="mt-2 text-[13px] text-ink-mute">{weekLine}</p>}
              </div>
            )}
            {inProgress.length > 0 && (
              <div className="mt-6">
                <CheckInForm chapter existing={d.todayCheckIn} hasCoach={d.coaches.length > 0} identityLevel={d.identity?.level} focuses={inProgress}
                  lines={inProgress.length > 1 ? Object.fromEntries(inProgress.map((f) => {
                    const c = d.focuses.find((x) => x.id === f.id)!;
                    return [f.id, <CenterLine key={f.id} compact start={c.startDate} day={f.day} cycleId={f.id} rows={d.checkIns} justSaved={!!checked} label={focusTitle(c)} />];
                  })) : undefined} />
              </div>
            )}
            {finishedFocuses.map((f) => (
              <Link key={f.id} href={`/cycle?id=${f.id}`} className="mt-5 btn-primary w-full">Open Wheel Alignment{d.focuses.length > 1 ? `: ${focusTitle(f)}` : ""}</Link>
            ))}
          </>
        ) : (
          <Link href="/start" className="mt-6 btn-primary w-full">Pick up where I left off</Link>
        )}
      </section>

      {/* The rest of the page: quiet sections between thin rules, the way a chapter keeps going. */}
      <div className="mt-10 divide-y divide-line/70 border-t border-line/70">
        <Link href="/identity" className="block py-5 transition hover:text-link">
          <p className="flex items-center justify-between font-book italic text-[16px] text-ink-soft">{d.identity?.role ? `In the driver's seat, as ${withArticle(d.identity.role)}` : "The Driver's Seat"}<Icon name="arrow" className="h-4 w-4 text-ink-mute" /></p>
          <p className="mt-2 font-book text-[21px] sm:text-[23px] leading-[1.35] text-heading line-clamp-4">{statement || "Claim who you are."}</p>
          {d.identity?.level === "REINVENT" && d.identity.personaName && <p className="mt-2 text-xs text-ink-mute">Performance identity: <span className="text-ink">{d.identity.personaName}</span></p>}
        </Link>

        <Link href="/network" className="flex items-baseline justify-between gap-4 py-4 transition hover:text-link">
          <span className="font-book text-[20px] text-heading">People</span>
          <span className={`text-[14px] ${overdue ? "text-alert" : "text-ink-soft"}`}>{overdue ? `${overdue} overdue` : dueSoon.length ? `${dueSoon.length} due soon` : d.relationships.length ? "All caught up" : "Add someone"}</span>
        </Link>

        <Link href="/focus" className="flex items-baseline justify-between gap-4 py-4 transition hover:text-link">
          <span className="font-book text-[20px] text-heading">The Windshield</span>
          <span className="text-right text-[14px] text-ink-soft">{d.focuses.length === 0 ? "Choose one or two things to work on" : d.focuses.length < MAX_FOCUSES ? "One focus. Room for one more." : "Two focuses. That's the most."}</span>
        </Link>

        {coachItems.length > 0 && (
          <section className="py-4" aria-label="From your coach">
            <p className="flex items-baseline justify-between"><span className="font-book text-[20px] text-heading">From your coach</span><Link href="/coaching" className="text-sm btn-link">Open</Link></p>
            <ul className="mt-2">
              {coachItems.map((x) => (
                <li key={x.key}>
                  <Link href={x.href} className="flex items-baseline gap-3 py-1.5 transition hover:text-link">
                    <span className="flex-1 text-[15px] line-clamp-1">{x.text}</span>
                    {x.side && <span className="whitespace-nowrap text-[13px] text-ink-mute">{x.side}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* The day, carried at the bottom like a page number. */}
      {solo && soloPos && <p className="mt-10 text-center text-[13px] text-ink-mute">{soloPos.day} of 30</p>}
    </div>
  );
}

const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"];
/** 10 becomes "Ten" and 23 "Twenty-Three", the way the book writes "Chapter Nine". */
function numberWord(n: number) {
  if (n <= 20) return WORDS[n] ?? String(n);
  if (n < 30) return `Twenty-${WORDS[n - 20]}`;
  return n === 30 ? "Thirty" : String(n);
}



