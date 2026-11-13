import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cohortReport } from "@/lib/reports";
import { DELIVERY_FORMATS } from "@/content/program";
import { fmt } from "@/lib/dates";
import { PageHeader, Card, Empty } from "@/components/ui";

export const metadata = { title: "Cohorts" };

export default async function CoachCohorts() {
  const coach = await requireUser("COACH");
  const memberships = await db.cohortMember.findMany({ where: { userId: coach.id, role: "FACILITATOR" }, include: { cohort: true } });
  const reports = await Promise.all(memberships.map((m) => cohortReport(m.cohortId)));
  const assigned = new Set((await db.coachAssignment.findMany({ where: { coachId: coach.id, active: true } })).map((a) => a.participantId));
  return (
    <>
      <PageHeader eyebrow="Facilitator" title="Group cohorts">Attendance and reinforcement are shown as group totals. Individual development records are visible only for participants assigned to you, and only what they share.</PageHeader>
      {reports.length === 0 && <Empty title="You are not facilitating a cohort" />}
      {reports.map((r) => (
        <Card key={r.cohort.id} className="mb-5">
          <h2 className="h2">{r.cohort.name}</h2>
          <p className="text-sm muted">{DELIVERY_FORMATS[r.cohort.deliveryFormat as keyof typeof DELIVERY_FORMATS].label} · {r.n} participants</p>
          <ul className="mt-4 divide-y divide-line">
            {r.bySegment.map((s) => (
              <li key={s.key} className="py-2 flex justify-between gap-3 text-[15px]">
                <span><span className="text-brass font-serif mr-2">{s.key}</span>{s.title}</span>
                <span className="muted text-sm">{fmt(s.startsAt, { month: "short", day: "numeric", hour: "numeric" })} · {s.pct == null ? `${s.present} present` : `${s.pct}% present`}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">Reinforcement participation: {r.reinforcingPct == null ? "shown once the group has 5 or more people" : `${r.reinforcingPct}%`}</p>
          <CohortMembers cohortId={r.cohort.id} assigned={assigned} />
        </Card>
      ))}
    </>
  );
}

async function CohortMembers({ cohortId, assigned }: { cohortId: string; assigned: Set<string> }) {
  const members = await db.cohortMember.findMany({ where: { cohortId, role: "PARTICIPANT" }, include: { user: { select: { id: true, name: true } } } });
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {members.map((m) => assigned.has(m.user.id)
        ? <Link key={m.id} href={`/coach/${m.user.id}`} className="chip !text-link">{m.user.name}</Link>
        : <span key={m.id} className="chip">{m.user.name}</span>)}
    </div>
  );
}
