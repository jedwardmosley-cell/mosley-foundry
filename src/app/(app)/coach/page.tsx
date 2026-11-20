import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCoachView } from "@/lib/access";
import { needsMe } from "@/lib/coachSummary";
import { SHARE_SCOPES } from "@/lib/access";
import { practiceSummary, cyclePosition } from "@/lib/cycle";
import { SEASON_LENGTH } from "@/content/program";
import { getContent } from "@/content";
import { fmtIn, SESSION_TIME } from "@/lib/zone";
import { zoneOf } from "@/lib/userZone";
import { ChapterOpening, Card, PillarMark, Empty } from "@/components/ui";
import type { PillarKey } from "@/content/types";
import { AddClientForm } from "@/components/AddClientForm";
import { Submit } from "@/components/Submit";
import { planCoachActions, setCoachCalendarLink } from "@/app/actions/coach";
import { CopyLink } from "@/components/CopyLink";
import { appUrl } from "@/lib/email";
import { AssistantDraft } from "@/components/AssistantDraft";
import { getDraft } from "@/lib/coachAssistant";
import { aiAvailable } from "@/lib/ai";

const ASSISTANT_NOTE: Record<string, string> = {
  ai_off: "The AI isn't set up for this app yet, so the assistant can't plan anything.",
  no_clients: "Add a client first. The assistant only works with your own clients.",
  failed: "That didn't come through. Try again, or say it a little differently.",
};

export const metadata = { title: "My clients" };

export default async function CoachHome({ searchParams }: { searchParams: Promise<{ draft?: string; assistant?: string; done?: string; calendar?: string }> }) {
  const coach = await requireUser("COACH");
  const sp = await searchParams;
  const draft = sp.draft ? await getDraft(coach.id, sp.draft) : null;
  const { pack } = await getContent();
  const assignments = await db.coachAssignment.findMany({ where: { coachId: coach.id, active: true }, include: { participant: { select: { id: true, name: true } } } });
  const views = await Promise.all(assignments.map((a) => getCoachView(coach, a.participant.id)));
  // Who needs me this week: the coach's own sessions and exercises, plus what each client shares.
  const ids = views.map((v) => v.participant.id);
  const [allSessions, allExercises] = await Promise.all([
    db.coachingSession.findMany({ where: { coachId: coach.id, participantId: { in: ids } }, select: { participantId: true, scheduledAt: true } }),
    db.assignedExercise.findMany({ where: { coachId: coach.id, participantId: { in: ids } }, select: { participantId: true, title: true, status: true, dueOn: true } }),
  ]);
  const needs = views
    .map((v) => ({ v, ...needsMe(v, allSessions.filter((x) => x.participantId === v.participant.id), allExercises.filter((x) => x.participantId === v.participant.id)) }))
    .sort((a, b) => b.weight - a.weight);
  const upcoming = await db.coachingSession.findMany({ where: { coachId: coach.id, scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" }, take: 5, include: { participant: { select: { name: true } } } });

  const plain = (name: string) => name.replace(/\s*\((?:demo|Demo)[^)]*\)\s*$/, "").trim();
  const ai = aiAvailable();
  const zone = await zoneOf(coach);
  const token = (await db.user.findUnique({ where: { id: coach.id }, select: { calendarToken: true } }))?.calendarToken;
  const feed = token ? `${appUrl()}/calendar/${token}.ics` : null;

  return (
    <>
      <ChapterOpening image="/chapters/rules-of-the-road.jpg" alt="Roads from above, each one going its own way" title="My clients" plain="Who needs you this week, and what each one shares">
        You see only what each client chooses to share with you. Journals and AI conversations are never visible to you.
      </ChapterOpening>

      {/* One list: every client, most pressing first. Each row opens that client's page. */}
      {views.length === 0 ? <Empty title="No clients yet">Add your first client below.</Empty> : (
        <section aria-label="Your clients" className="border-t border-line/70">
          <ol className="divide-y divide-line/60">
            {needs.map(({ v, reasons }) => {
              const pk = v.profile?.priorityPillar as PillarKey | undefined;
              const ps = v.scopes.includes("PRACTICE") ? practiceSummary(v.practice.filter((p) => p.status)) : null;
              const day = ps && v.cycle?.status === "ACTIVE" ? `Day ${cyclePosition(v.cycle.startDate).day} of 30${v.cycle.seasonMonth ? `, month ${v.cycle.seasonMonth} of ${SEASON_LENGTH}` : ""}` : null;
              return (
                <li key={v.participant.id}>
                  <Link href={`/coach/${v.participant.id}`} className="group block py-5">
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="font-book text-[22px] leading-tight text-heading group-hover:text-link">{plain(v.participant.name)}</span>
                      <span className="shrink-0 text-xs text-ink-mute">{v.scopes.length} of {Object.keys(SHARE_SCOPES).length} areas shared</span>
                    </p>
                    <p className="mt-1 text-[15px] text-ink-soft">{reasons.length ? `${reasons.join(". ")}.` : "On track this week."}</p>
                    {(pk || day || ps) && (
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-mute">
                        {pk && <span className="flex items-center gap-1.5"><PillarMark k={pk} size="sm" />{pack.pillars.find((x) => x.key === pk)?.name}</span>}
                        {day && <span>{day}</span>}
                        {ps && <span>Last 30 days: {ps.done} done, {ps.partial} partial, {ps.notYet} not yet</span>}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {upcoming.length > 0 && (
        <Card className="mt-2">
          <p className="section-label">Upcoming sessions</p>
          <ul className="mt-2 divide-y divide-line/60">
            {upcoming.map((s) => <li key={s.id} className="py-2 flex justify-between gap-3 text-[15px]"><Link href={`/coach/${s.participantId}#sessions`} className="hover:text-link">{plain(s.participant.name)}</Link><span className="text-sm text-ink-mute">{fmtIn(s.scheduledAt, zone, SESSION_TIME)}</span></li>)}
          </ul>
        </Card>
      )}

      <Card id="assistant" className="scroll-mt-24">
        <h2 className="h2">Coach assistant</h2>
        {ai ? <p className="mt-1 text-[15px] text-ink-soft">Say what you want done for your clients, in plain words. You see exactly what it will do, and nothing happens until you approve. It sees your clients&apos; names, never what they share.</p>
          : <p className="mt-1 text-sm text-ink-mute">{ASSISTANT_NOTE.ai_off}</p>}
        {sp.done && <p role="status" className="notice mt-3">{Number(sp.done) === 0 ? "Nothing was done." : `Done: ${sp.done} ${Number(sp.done) === 1 ? "action" : "actions"}.`}</p>}
        {sp.assistant && ASSISTANT_NOTE[sp.assistant] && <p role="status" className="notice mt-3">{ASSISTANT_NOTE[sp.assistant]}</p>}
        {!draft && ai && (
          <form action={planCoachActions} className="mt-3 space-y-3">
            <textarea name="instruction" required maxLength={4000} rows={3} className="textarea" aria-label="What should the assistant do?" placeholder="Assign Bob and Paul the Mirrors road test, due Friday. Book a session with Dana next Tuesday at 10 to talk about her director." />
            <Submit className="btn-primary">Plan it</Submit>
          </form>
        )}
        {draft && <AssistantDraft draft={draft} />}
      </Card>

      <details id="add-client" className="group/add card" open={views.length === 0}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="h3">Add a client</span>
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rotate-45 border-b-[1.6px] border-r-[1.6px] border-ink-mute transition group-open/add:-rotate-[135deg]" />
        </summary>
        <p className="text-sm text-ink-mute mt-2 mb-4">Enter their name and email. If they are new, the app creates their account and gives you a temporary password to send them. Adding someone shares nothing with you. They choose what you can see.</p>
        <AddClientForm />
      </details>

      {/* The coach's own calendar link: every coaching and cohort session, kept up to date. */}
      <details id="calendar" className="group/cal card scroll-mt-24" open={!!sp.calendar}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block h3">My calendar</span>
            <span className="mt-0.5 block text-sm text-ink-mute">{feed ? "On. Your sessions are on your calendar." : "Put your sessions on the calendar you already use"}</span>
          </span>
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rotate-45 border-b-[1.6px] border-r-[1.6px] border-ink-mute transition group-open/cal:-rotate-[135deg]" />
        </summary>
        <p className="mt-3 text-[15px] text-ink-soft">Every session you book with a client, and every cohort session you facilitate. Book, move or cancel one here and your calendar follows.</p>
        {feed ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={feed.replace(/^https?:/, "webcal:")} className="btn-quiet !px-4 !py-2 text-sm">Apple Calendar</a>
              <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed.replace(/^https?:/, "webcal:"))}`} target="_blank" rel="noopener" className="btn-quiet !px-4 !py-2 text-sm">Google Calendar</a>
              <a href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feed)}&name=${encodeURIComponent("Both Hands on the Wheel: coaching")}`} target="_blank" rel="noopener" className="btn-quiet !px-4 !py-2 text-sm">Outlook</a>
              <CopyLink url={feed} />
            </div>
            <p className="mt-3 text-xs text-ink-mute">
              This link is private. It shows your clients&apos; names and session times, never agendas, notes or anything they share. Don&apos;t pass it on.
              Calendar apps check for changes on their own schedule, from a few minutes to about a day.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <form action={setCoachCalendarLink}><input type="hidden" name="mode" value="RESET" /><button className="btn-link">Get a new link (the old one stops working)</button></form>
              <form action={setCoachCalendarLink}><input type="hidden" name="mode" value="OFF" /><button className="text-ink-mute hover:text-alert">Turn off my calendar link</button></form>
            </div>
          </>
        ) : (
          <form action={setCoachCalendarLink} className="mt-4"><input type="hidden" name="mode" value="ON" /><Submit>Put it on my calendar</Submit></form>
        )}
      </details>
    </>
  );
}
