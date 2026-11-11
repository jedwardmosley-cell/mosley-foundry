import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCoachView } from "@/lib/access";
import { attentionFlags } from "@/lib/coachSummary";
import { practiceSummary } from "@/lib/cycle";
import { getContent } from "@/content";
import { fmt } from "@/lib/dates";
import { PageHeader, Card, PillarMark, Empty } from "@/components/ui";
import type { PillarKey } from "@/content/types";
import { AddClientForm } from "@/components/AddClientForm";

export const metadata = { title: "My clients" };

export default async function CoachHome() {
  const coach = await requireUser("COACH");
  const { pack } = await getContent();
  const assignments = await db.coachAssignment.findMany({ where: { coachId: coach.id, active: true }, include: { participant: { select: { id: true, name: true } } } });
  const views = await Promise.all(assignments.map((a) => getCoachView(coach, a.participant.id)));
  const upcoming = await db.coachingSession.findMany({ where: { coachId: coach.id, scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" }, take: 5, include: { participant: { select: { name: true } } } });

  return (
    <>
      <PageHeader eyebrow="Coach" title="My clients">
        You see only what each client has chosen to share with you. Journals and AI conversations are never visible to you.
      </PageHeader>
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
                <span className="text-xs muted">{v.scopes.length} of 8 areas shared</span>
              </div>
              <div className="mt-3 text-[15px] space-y-1.5">
                <p className="flex items-center gap-2">{pk ? <><PillarMark k={pk} size="sm" /> {pack.pillars.find((p) => p.key === pk)?.name}</> : <span className="muted">Focus not shared</span>}</p>
                {ps ? <p className="text-sm">Practice, last 30 days: {ps.done} done · {ps.partial} partial · {ps.notYet} not yet</p> : <p className="text-sm muted">Practice not shared</p>}
              </div>
              {flags.length > 0 && <ul className="mt-3 space-y-1">{flags.map((f) => <li key={f} className="text-sm text-clay">· {f}</li>)}</ul>}
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
