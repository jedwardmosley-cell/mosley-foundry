import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cohortReport, MIN_GROUP } from "@/lib/reports";
import { PageHeader, Card } from "@/components/ui";

export const metadata = { title: "Reports" };

export default async function Reports() {
  const a = await requireUser("ADMIN");
  const cohorts = await db.cohort.findMany({ where: { orgId: a.orgId ?? "__none__" } });
  const reports = await Promise.all(cohorts.map((c) => cohortReport(c.id)));
  return (
    <>
      <PageHeader eyebrow="Aggregate only" title="Program reporting">
        Group totals for enrollment, attendance, completion and reinforcement participation. Percentages appear only for groups of {MIN_GROUP} or more so no individual can be singled out. No assessment scores, reflections, journals, EQ-i results or coaching content are reported.
      </PageHeader>
      <div className="space-y-4">
        {reports.map((r) => (
          <Card key={r.cohort.id}>
            <h2 className="h3">{r.cohort.name}</h2>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-paper p-3"><dd className="font-serif text-2xl">{r.n}</dd><dt className="text-xs muted">enrolled</dt></div>
              <div className="rounded-xl bg-paper p-3"><dd className="font-serif text-2xl">{r.completedPct == null ? "·" : `${r.completedPct}%`}</dd><dt className="text-xs muted">completed all segments</dt></div>
              <div className="rounded-xl bg-paper p-3"><dd className="font-serif text-2xl">{r.reinforcingPct == null ? "·" : `${r.reinforcingPct}%`}</dd><dt className="text-xs muted">active in reinforcement</dt></div>
            </dl>
            <ul className="mt-4 grid grid-cols-6 gap-2 text-center text-xs">
              {r.bySegment.map((s) => <li key={s.key} className="rounded-lg border border-line p-2"><span className="block font-serif text-brass">{s.key}</span>{s.pct == null ? "·" : `${s.pct}%`}</li>)}
            </ul>
            {r.small && <p className="mt-3 text-xs text-ink-mute">Fewer than {MIN_GROUP} participants: percentages hidden.</p>}
          </Card>
        ))}
      </div>
    </>
  );
}
