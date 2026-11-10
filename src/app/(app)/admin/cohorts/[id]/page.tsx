import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateSession, enroll, markAttendance, assignCoach } from "@/app/actions/admin";
import { SEGMENTS, DELIVERY_FORMATS } from "@/content/program";
import { cohortReport } from "@/lib/reports";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";

const local = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default async function CohortAdmin({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireUser("ADMIN");
  const { id } = await params;
  const cohort = await db.cohort.findFirst({
    where: { id, orgId: a.orgId ?? "__none__" },
    include: {
      sessions: { orderBy: { startsAt: "asc" }, include: { attendance: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!cohort) notFound();
  const report = await cohortReport(cohort.id);
  const facilitators = cohort.members.filter((m) => m.role === "FACILITATOR");
  const participants = cohort.members.filter((m) => m.role === "PARTICIPANT");
  const assignments = await db.coachAssignment.findMany({ where: { participantId: { in: participants.map((p) => p.userId) }, active: true }, include: { coach: { select: { name: true } } } });
  const flashRaw = (await cookies()).get("enroll_flash")?.value;
  const flash = flashRaw ? (JSON.parse(flashRaw) as { email: string; temp: string }) : null;

  return (
    <>
      <PageHeader eyebrow="Leading Others cohort" title={cohort.name}>{DELIVERY_FORMATS[cohort.deliveryFormat as keyof typeof DELIVERY_FORMATS].label} · reinforcement {cohort.reinforceDays} days</PageHeader>

      {flash && (
        <Card className="mb-5 border-brass">
          <p className="text-[15px]">Account created for <strong>{flash.email}</strong>. Temporary password: <code className="bg-paper px-1.5 py-0.5 rounded">{flash.temp}</code></p>
          <p className="text-xs text-ink-mute mt-1">Shown once. Share it privately; ask them to change it.</p>
        </Card>
      )}

      <Card>
        <h2 className="h3">Schedule</h2>
        <div className="mt-3 space-y-3">
          {cohort.sessions.map((s) => {
            const seg = SEGMENTS.find((x) => x.key === s.segmentKey)!;
            return (
              <form key={s.id} action={updateSession} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto] items-end rounded-xl bg-paper p-3">
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="cohortId" value={cohort.id} />
                <p className="text-[15px]"><span className="text-brass font-serif mr-2">{seg.key}</span>{seg.title}</p>
                <Field label="Starts"><input type="datetime-local" name="startsAt" defaultValue={local(s.startsAt)} className="input" /></Field>
                <Field label="Facilitator">
                  <select name="facilitatorId" defaultValue={s.facilitatorId ?? ""} className="input">
                    <option value="">Unassigned</option>
                    {facilitators.map((f) => <option key={f.userId} value={f.userId}>{f.user.name}</option>)}
                  </select>
                </Field>
                <Field label="Location"><input name="location" defaultValue={s.location} className="input" /></Field>
                <Submit className="btn-quiet">Save</Submit>
              </form>
            );
          })}
        </div>
      </Card>

      <Card className="mt-5">
        <h2 className="h3">Attendance</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-mute"><th className="py-2 pr-3 font-medium">Participant</th>{cohort.sessions.map((s) => <th key={s.id} className="font-medium px-1 text-center">{s.segmentKey}</th>)}<th className="font-medium pl-3">Coach</th></tr></thead>
            <tbody>
              {participants.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="py-2 pr-3 whitespace-nowrap">{m.user.name}</td>
                  {cohort.sessions.map((s) => {
                    const st = s.attendance.find((x) => x.userId === m.userId)?.status;
                    const next = st === "PRESENT" ? "ABSENT" : st === "ABSENT" ? "EXCUSED" : "PRESENT";
                    return (
                      <td key={s.id} className="px-1 text-center">
                        <form action={markAttendance}>
                          <input type="hidden" name="cohortId" value={cohort.id} /><input type="hidden" name="sessionId" value={s.id} />
                          <input type="hidden" name="userId" value={m.userId} /><input type="hidden" name="status" value={next} />
                          <button aria-label={`${m.user.name}, segment ${s.segmentKey}: ${st ?? "not recorded"}. Mark ${next.toLowerCase()}`} className={`h-7 w-7 rounded-md border text-xs ${st === "PRESENT" ? "bg-navy text-white border-navy" : st === "ABSENT" ? "bg-clay-soft text-clay border-clay/30" : st === "EXCUSED" ? "bg-brass-soft border-brass/30" : "bg-white border-line"}`}>
                            {st === "PRESENT" ? "✓" : st === "ABSENT" ? "×" : st === "EXCUSED" ? "E" : ""}
                          </button>
                        </form>
                      </td>
                    );
                  })}
                  <td className="pl-3">
                    {assignments.find((x) => x.participantId === m.userId)?.coach.name ?? (
                      facilitators.length > 0 && (
                        <form action={assignCoach} className="flex gap-1">
                          <input type="hidden" name="cohortId" value={cohort.id} /><input type="hidden" name="participantId" value={m.userId} />
                          <select name="coachId" className="input !py-1 !text-sm">{facilitators.map((f) => <option key={f.userId} value={f.userId}>{f.user.name}</option>)}</select>
                          <button className="btn-quiet !py-1 !px-2 text-sm">Assign</button>
                        </form>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-mute">Click a cell to cycle present, absent, excused. Assigning a coach shares no development data; each participant decides what their coach sees.</p>
      </Card>

      <Card className="mt-5">
        <h2 className="h3">Program status</h2>
        <p className="mt-2 text-[15px]">Completed all six segments: {report.completedPct == null ? `${report.completed} of ${report.n}` : `${report.completedPct}%`}</p>
        <p className="text-[15px]">Active in reinforcement: {report.reinforcingPct == null ? "shown for groups of 5 or more" : `${report.reinforcingPct}%`}</p>
      </Card>

      <Card className="mt-5">
        <h2 className="h3">Enroll</h2>
        <form action={enroll} className="mt-3 grid gap-3 sm:grid-cols-4 items-end">
          <input type="hidden" name="cohortId" value={cohort.id} />
          <Field label="Name"><input name="name" required className="input" /></Field>
          <Field label="Email"><input type="email" name="email" required className="input" /></Field>
          <Field label="Role"><select name="role" className="input"><option value="PARTICIPANT">Participant</option><option value="FACILITATOR">Facilitator / coach</option></select></Field>
          <Submit>Enroll</Submit>
        </form>
      </Card>
    </>
  );
}
