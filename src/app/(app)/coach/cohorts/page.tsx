import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cohortReport } from "@/lib/reports";
import { DELIVERY_FORMATS } from "@/content/program";
import { fmt } from "@/lib/dates";
import { PageHeader, Card, Empty } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { prepareCohortSession } from "@/app/actions/coach";
import { aiAvailable, type CohortPrep } from "@/lib/ai";
import { SEGMENTS } from "@/content/program";

export const metadata = { title: "Cohorts" };

export default async function CoachCohorts({ searchParams }: { searchParams: Promise<{ prepnote?: string }> }) {
  const coach = await requireUser("COACH");
  const sp = await searchParams;
  const memberships = await db.cohortMember.findMany({ where: { userId: coach.id, role: "FACILITATOR" }, include: { cohort: true } });
  const reports = await Promise.all(memberships.map((m) => cohortReport(m.cohortId)));
  const assigned = new Set((await db.coachAssignment.findMany({ where: { coachId: coach.id, active: true } })).map((a) => a.participantId));
  return (
    <>
      <PageHeader eyebrow="Facilitator" title="Group cohorts">Attendance and reinforcement are shown as group totals. Individual development records are visible only for participants assigned to you, and only what they share.</PageHeader>
      {reports.length === 0 && <Empty title="You are not facilitating a cohort" />}
      {reports.map((r) => (
        <Card key={r.cohort.id} id={`cohort-${r.cohort.id}`} className="mb-5 scroll-mt-24">
          <h2 className="h2">{r.cohort.name}</h2>
          <p className="text-sm muted">{DELIVERY_FORMATS[r.cohort.deliveryFormat as keyof typeof DELIVERY_FORMATS].label}, {r.n} participants</p>
          <ul className="mt-4 divide-y divide-line">
            {r.bySegment.map((s) => (
              <li key={s.key} className="py-2 flex justify-between gap-3 text-[15px]">
                <span><span className="text-ink-mute font-bold mr-2">{s.key}</span>{s.title}</span>
                <span className="muted text-sm">{fmt(s.startsAt, { month: "short", day: "numeric", hour: "numeric" })}, {s.pct == null ? `${s.present} present` : `${s.pct}% present`}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">Reinforcement participation: {r.reinforcingPct == null ? "shown once the group has 5 or more people" : `${r.reinforcingPct}%`}</p>
          <CohortMembers cohortId={r.cohort.id} assigned={assigned} />
          <CohortPrepPanel coachId={coach.id} cohortId={r.cohort.id} note={sp.prepnote} />
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

/** Cohort session prep: a plan for the next group session, from group totals only. */
async function CohortPrepPanel({ coachId, cohortId, note }: { coachId: string; cohortId: string; note?: string }) {
  const b = await db.cohortBrief.findFirst({ where: { coachId, cohortId }, orderBy: { createdAt: "desc" } });
  let prep: (CohortPrep & { small?: boolean; minutes?: number }) | null = null;
  try { prep = b ? JSON.parse(b.content) : null; } catch { prep = null; }
  const seg = SEGMENTS.find((x) => x.key === b?.segmentKey);
  return (
    <div className="mt-6 border-t border-line/60 pt-5">
      <h3 className="h3">Session prep</h3>
      <p className="mt-1 text-[15px] text-ink-soft">A plan for the next session: what the group is working on, where it may be stuck, a timed outline and three questions for the room. Built from group totals only, never anything about one person. Groups under 5 get a plan from the segment content alone.</p>
      {note && <p role="status" className="notice mt-3">{note === "ai_off" ? "The AI isn't set up for this app yet, so there's no plan." : "The plan didn't come through. Try again in a minute."}</p>}
      {aiAvailable() ? (
        <form action={prepareCohortSession} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="cohortId" value={cohortId} />
          <label className="text-xs text-ink-mute">Length<select name="minutes" defaultValue="120" className="input mt-1 !w-auto">{[60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
          <Submit className={prep ? "btn-quiet" : "btn-primary"}>{prep ? "Plan it again" : "Plan the next session"}</Submit>
        </form>
      ) : !prep && <p className="mt-3 text-sm text-ink-mute">The AI isn&apos;t set up for this app yet.</p>}
      {prep && b && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-ink-mute">Draft from AI, {fmt(b.createdAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{seg ? `, for segment ${seg.key}, ${seg.title}` : ""}{prep.small ? ", from the segment content only (the group is under 5)" : ", from group totals"}. Adapt it to the room.</p>
          {prep.working.length > 0 && <section><p className="section-label">What the group is working on</p><ul className="mt-1.5 list-disc pl-5 space-y-1 text-[15px]">{prep.working.map((x) => <li key={x}>{x}</li>)}</ul></section>}
          {prep.stuck.length > 0 && <section><p className="section-label">Where it may be stuck</p><ul className="mt-1.5 list-disc pl-5 space-y-1 text-[15px]">{prep.stuck.map((x) => <li key={x}>{x}</li>)}</ul></section>}
          {prep.plan.length > 0 && (
            <section>
              <p className="section-label">The plan{prep.minutes ? `, ${prep.minutes} minutes` : ""}</p>
              <ol className="mt-1.5 space-y-2">
                {prep.plan.map((x, i) => (
                  <li key={i} className="flex gap-3 rounded-2xl bg-ink/[0.04] px-3 py-2.5">
                    <span className="w-14 shrink-0 text-sm font-bold text-heading">{x.minutes} min</span>
                    <span className="text-[15px]"><span className="font-medium text-heading">{x.part}.</span> {x.detail}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {prep.questions.length > 0 && (
            <section className="border-l-4 border-lane pl-4">
              <p className="section-label">Questions for the room</p>
              <ol className="mt-1.5 list-decimal pl-5 space-y-1.5 font-serif text-[18px] leading-snug text-heading">{prep.questions.map((x) => <li key={x}>{x}</li>)}</ol>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
