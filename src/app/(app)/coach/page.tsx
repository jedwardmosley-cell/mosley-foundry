import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCoachView } from "@/lib/access";
import { needsMe } from "@/lib/coachSummary";
import { SHARE_SCOPES } from "@/lib/access";
import { practiceSummary, cyclePosition } from "@/lib/cycle";
import { SEASON_LENGTH } from "@/content/program";
import { getContent } from "@/content";
import { fmt } from "@/lib/dates";
import { ChapterOpening, Card, PillarMark, Empty } from "@/components/ui";
import type { PillarKey } from "@/content/types";
import { AddClientForm } from "@/components/AddClientForm";
import { Submit } from "@/components/Submit";
import { planCoachActions } from "@/app/actions/coach";
import { AssistantDraft } from "@/components/AssistantDraft";
import { getDraft } from "@/lib/coachAssistant";
import { aiAvailable } from "@/lib/ai";

const ASSISTANT_NOTE: Record<string, string> = {
  ai_off: "The AI isn't set up for this app yet, so the assistant can't plan anything.",
  no_clients: "Add a client first. The assistant only works with your own clients.",
  failed: "That didn't come through. Try again, or say it a little differently.",
};

export const metadata = { title: "My clients" };

export default async function CoachHome({ searchParams }: { searchParams: Promise<{ draft?: string; assistant?: string; done?: string }> }) {
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
            {upcoming.map((s) => <li key={s.id} className="py-2 flex justify-between gap-3 text-[15px]"><Link href={`/coach/${s.participantId}#sessions`} className="hover:text-link">{plain(s.participant.name)}</Link><span className="text-sm text-ink-mute">{fmt(s.scheduledAt, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></li>)}
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
    </>
  );
}
