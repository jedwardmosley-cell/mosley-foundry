import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadParticipant } from "@/lib/participant";
import { getContent } from "@/content";
import { cycleWeeks, cyclePosition } from "@/lib/cycle";
import { fmt, daysBetween, mondayOf } from "@/lib/dates";
import { fmtIn, SESSION_TIME } from "@/lib/zone";
import { db } from "@/lib/db";
import { todayHeadline } from "@/lib/todayHeadline";
import { getJourney, JOURNEY_STEPS } from "@/lib/journey";
import { withArticle } from "@/content/whoIAm";
import type { PillarKey } from "@/content/types";
import { CheckInForm, type CheckInFocus } from "@/components/CheckInForm";
import { CenterLine } from "@/components/CenterLine";
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
  // What they said in last week's Mirrors this week needs.
  const lastWeek = await db.weeklyReflection.findUnique({ where: { userId_weekOf: { userId: u.id, weekOf: mondayOf(new Date(Date.now() - 7 * 864e5)) } }, select: { nextWeek: true } });
  const thisWeekNeeds = lastWeek?.nextWeek?.trim() ?? "";
  const dueSoon = d.relationships.filter((r) => r.nextCheckIn && daysBetween(new Date(), r.nextCheckIn) <= 2).slice(0, 3);
  const coachItems = [
    nextSession && { key: "s", href: "/coaching", icon: "clock", kind: "Session", text: `With ${nextSession.coach.name.split(" (")[0]}`, side: fmtIn(nextSession.scheduledAt, d.profile.timezone, SESSION_TIME) },
    ...openExercises.map((x) => ({ key: x.id, href: "/coaching", icon: "pencil", kind: "Exercise", text: x.title, side: x.dueOn ? `Due ${fmt(x.dueOn)}` : "New" })),
    lastCommitments && { key: "c", href: "/coaching", icon: "check", kind: "You agreed", text: lastCommitments.commitments, side: fmt(lastCommitments.scheduledAt) },
  ].filter(Boolean) as { key: string; href: string; icon: IconName; kind: string; text: string; side: string }[];

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

      {/* The day, set like a chapter opening: the day, the road ahead, the title, then the check-in. */}
      <section aria-label="Today">
        <p className="flex items-baseline justify-between gap-3">
          <span className="font-book text-[30px] sm:text-[34px] leading-none text-heading">{dayTitle}</span>
          <span className="text-[13px] text-ink-mute">{fmt(new Date(), { weekday: "short", month: "short", day: "numeric" })}</span>
        </p>
        {/* The gauges: the pencil drawing on a light page, the dark version on a dark one. */}
        <div className="mt-4 -mx-4 sm:mx-0 aspect-[16/9] bg-ink/10 bg-cover bg-center dark:hidden" style={{ backgroundImage: "url(/chapters/dashboard-light.jpg)" }} role="img" aria-label="The gauges on the dashboard" />
        <div className="mt-4 -mx-4 sm:mx-0 aspect-[16/9] bg-ink/10 bg-cover bg-center hidden dark:block" style={{ backgroundImage: "url(/chapters/dashboard-dark.jpg)" }} role="img" aria-label="The gauges on the dashboard" />

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

      {/* The rest of the page, like the back half of a chapter: the statement as a quote, two readings side by side, then the coach's notes. */}
      <div className="mt-10 border-t border-line/70">
        {/* Who's behind the wheel: a quote from the client's own book. */}
        <Link href="/identity" className="group block py-6">
          <p className="flex items-center justify-between font-book italic text-[16px] text-ink-soft">{d.identity?.role ? `In the driver's seat, as ${withArticle(d.identity.role)}` : "The Driver's Seat"}<Icon name="arrow" className="h-4 w-4 text-ink-mute" /></p>
          <blockquote className="mt-3 border-l-2 border-ink/20 pl-4 font-book text-[21px] sm:text-[23px] leading-[1.35] text-heading line-clamp-4 group-hover:text-link">{statement || "Claim who you are."}</blockquote>
          {d.identity?.level === "REINVENT" && d.identity.personaName && <p className="mt-2 pl-[19px] text-xs text-ink-mute">Performance identity: <span className="text-ink">{d.identity.personaName}</span></p>}
        </Link>

        {thisWeekNeeds && (
          <Link href="/reflect" className="block border-t border-line/70 py-5 transition hover:text-link">
            <p className="font-book italic text-[16px] text-ink-soft">This week needs, from your Mirrors</p>
            <p className="mt-1 font-book text-[19px] leading-snug text-heading">{thisWeekNeeds}</p>
          </Link>
        )}

        {/* Two readings side by side, like two dials on the dashboard. */}
        <div className="grid grid-cols-2 divide-x divide-line/70 border-y border-line/70">
          <Link href="/network" className="block py-5 pr-4 transition hover:text-link">
            <p className="font-book italic text-[16px] text-ink-soft">People</p>
            <p className={`mt-1 font-book text-[22px] leading-tight ${overdue ? "text-alert" : "text-heading"}`}>{overdue ? `${overdue} overdue` : dueSoon.length ? `${dueSoon.length} due soon` : d.relationships.length ? "All caught up" : "Add someone"}</p>
            <p className="mt-1 text-[13px] text-ink-mute">{d.relationships.length ? `${d.relationships.length} in your corner` : "Nobody named yet"}</p>
          </Link>
          <Link href="/focus" className="block py-5 pl-4 transition hover:text-link">
            <p className="font-book italic text-[16px] text-ink-soft">The Windshield</p>
            <p className="mt-1 font-book text-[22px] leading-tight text-heading">{d.focuses.length === 0 ? "None yet" : d.focuses.length === 1 ? "1 focus" : `${d.focuses.length} focuses`}</p>
            <p className="mt-1 text-[13px] text-ink-mute">{d.focuses.length === 0 ? "Choose one or two" : d.focuses.length < MAX_FOCUSES ? "Room for one more" : "That's the most"}</p>
          </Link>
        </div>

        {coachItems.length > 0 && (
          <section className="py-5" aria-label="From your coach">
            <p className="flex items-baseline justify-between"><span className="font-book italic text-[16px] text-ink-soft">From your coach</span><Link href="/coaching" className="text-sm btn-link">Open</Link></p>
            <ul className="mt-2 divide-y divide-line/50">
              {coachItems.map((x) => (
                <li key={x.key}>
                  <Link href={x.href} className="flex items-start gap-4 py-3 transition hover:text-link">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-bold text-gold">{x.kind}</span>
                      <span className="mt-0.5 block font-book text-[18px] leading-snug text-heading line-clamp-2">{x.text}</span>
                    </span>
                    {x.side && <span className="mt-[18px] shrink-0 whitespace-nowrap text-[13px] text-ink-mute">{x.side}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* The day, carried at the bottom like a page number. */}
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



