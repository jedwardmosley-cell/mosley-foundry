import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCoachView } from "@/lib/access";
import { attentionFlags, needsMe } from "@/lib/coachSummary";
import { SHARE_SCOPES } from "@/lib/access";
import { practiceSummary, cyclePosition } from "@/lib/cycle";
import { SEASON_LENGTH } from "@/content/program";
import { getContent } from "@/content";
import { fmt } from "@/lib/dates";
import { PageHeader, Card, PillarMark, Empty } from "@/components/ui";
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
  const needing = needs.filter((n) => n.weight > 0);
  const upcoming = await db.coachingSession.findMany({ where: { coachId: coach.id, scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" }, take: 5, include: { participant: { select: { name: true } } } });

  return (
    <>
      <PageHeader eyebrow="Coach" title="My clients">
        You see only what each client has chosen to share with you. Journals and AI conversations are never visible to you.
      </PageHeader>

      {views.length > 0 && (
        <Card className="mb-6">
          <h2 className="h2">Who needs me this week</h2>
          <p className="mt-1 text-[15px] text-ink-soft">Your clients, most pressing first, with the reasons. From what each one shares with you, plus your own sessions and exercises.</p>
          {needing.length === 0 && <p className="mt-3 text-[15px]">Everyone is on track this week.</p>}
          <ol className="mt-3 divide-y divide-line/60">
            {needing.map(({ v, reasons }) => (
              <li key={v.participant.id} className="py-2.5">
                <Link href={`/coach/${v.participant.id}`} className="font-bold text-heading hover:text-link">{v.participant.name.replace(/\s*\(Demo\)$/, "")}</Link>
                <p className="mt-0.5 text-[15px] text-ink-soft">{reasons.join(". ")}.</p>
              </li>
            ))}
          </ol>
          {needing.length > 0 && needing.length < views.length && <p className="mt-2 text-sm text-ink-mute">The rest are on track: {needs.filter((n) => n.weight === 0).map((n) => n.v.participant.name.replace(/\s*\(Demo\)$/, "")).join(", ")}.</p>}
        </Card>
      )}
      <Card id="assistant" className="mb-6 scroll-mt-24">
        <h2 className="h2">Coach assistant</h2>
        <p className="mt-1 text-[15px] text-ink-soft">Say what you want done for your clients, in plain words. The assistant lays out exactly what it will do, and nothing happens until you approve it. It works only with your own clients and sees their names, never what they share.</p>
        {sp.done && <p role="status" className="notice mt-3">{Number(sp.done) === 0 ? "Nothing was done." : `Done: ${sp.done} ${Number(sp.done) === 1 ? "action" : "actions"}.`}</p>}
        {sp.assistant && ASSISTANT_NOTE[sp.assistant] && <p role="status" className="notice mt-3">{ASSISTANT_NOTE[sp.assistant]}</p>}
        {!draft && (aiAvailable() ? (
          <form action={planCoachActions} className="mt-3 space-y-3">
            <textarea name="instruction" required maxLength={4000} rows={3} className="textarea" aria-label="What should the assistant do?" placeholder="Assign Bob and Paul the Mirrors road test, due Friday. Book a session with Dana next Tuesday at 10 to talk about her director." />
            <Submit className="btn-primary">Plan it</Submit>
          </form>
        ) : <p className="mt-3 text-sm text-ink-mute">{ASSISTANT_NOTE.ai_off}</p>)}
        {draft && <AssistantDraft draft={draft} />}
      </Card>
      {upcoming.length > 0 && (
        <Card className="mb-5">
          <p className="eyebrow">Upcoming sessions</p>
          <ul className="mt-2 divide-y divide-line">
            {upcoming.map((s) => <li key={s.id} className="py-2 flex justify-between text-[15px]"><span>{s.participant.name}</span><span className="muted text-sm">{fmt(s.scheduledAt, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></li>)}
          </ul>
        </Card>
      )}
      {views.length === 0 && <Empty title="No clients yet">Add your first client below.</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {views.map((v) => {
          const flags = attentionFlags(v);
          const pk = v.profile?.priorityPillar as PillarKey | undefined;
          const ps = v.scopes.includes("PRACTICE") ? practiceSummary(v.practice.filter((p) => p.status)) : null;
          return (
            <Link key={v.participant.id} href={`/coach/${v.participant.id}`} className="card block hover:border-navy/40">
              <div className="flex items-center justify-between gap-3">
                <h2 className="h3">{v.participant.name}</h2>
                <span className="text-xs muted">{v.scopes.length} of {Object.keys(SHARE_SCOPES).length} areas shared</span>
              </div>
              <div className="mt-3 text-[15px] space-y-1.5">
                <p className="flex items-center gap-2">{pk ? <><PillarMark k={pk} size="sm" /> {pack.pillars.find((p) => p.key === pk)?.name}</> : <span className="muted">Focus not shared</span>}</p>
                {ps && (v.cycle?.status === "ACTIVE"
                  ? <p className="text-sm font-medium">{v.cycle.seasonMonth ? `Season month ${v.cycle.seasonMonth} of ${SEASON_LENGTH}, ` : ""}Day {cyclePosition(v.cycle.startDate).day} of 30</p>
                  : <p className="text-sm muted">No 30 days under way</p>)}
                {ps ? <p className="text-sm">Practice, last 30 days: {ps.done} done, {ps.partial} partial, {ps.notYet} not yet</p> : <p className="text-sm muted">Practice not shared</p>}
              </div>
              {flags.length > 0 && <ul className="mt-3 space-y-1 list-disc pl-5">{flags.map((f) => <li key={f} className="text-sm text-alert">{f}</li>)}</ul>}
            </Link>
          );
        })}
      </div>
      <Card className="mt-6">
        <h2 className="h3">Add a client</h2>
        <p className="text-sm muted mt-1 mb-4">Enter their name and email. If they are new, the app creates their account and gives you a temporary password to send them. Adding someone shares nothing with you. They choose what you can see.</p>
        <AddClientForm />
      </Card>
    </>
  );
}
