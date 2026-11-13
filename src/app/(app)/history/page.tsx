import { requireUser } from "@/lib/auth";
import { loadParticipant } from "@/lib/participant";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { scoresFrom, total } from "@/lib/forge";
import { practiceSummary } from "@/lib/cycle";
import { toggleEntryShared } from "@/app/actions/participant";
import { DAY30_DECISIONS, CHECKIN_STATUS } from "@/content/program";
import { fmt } from "@/lib/dates";
import { PILLAR_KEYS } from "@/content/types";
import { PageHeader, Card, Privacy } from "@/components/ui";
import { CHECKIN_IDENTITY } from "@/content/identity";

export const metadata = { title: "History & export" };

export default async function HistoryPage() {
  const u = await requireUser("PARTICIPANT");
  const d = await loadParticipant(u.id);
  const { pack } = await getContent();
  const cycles = await db.developmentCycle.findMany({ where: { userId: u.id }, orderBy: { startDate: "desc" }, include: { checkIns: true } });
  const reflections = await db.dailyCheckIn.findMany({ where: { userId: u.id, OR: [{ reflection: { not: "" } }, { note: { not: "" } }, { identityActed: { not: "" } }] }, orderBy: { date: "desc" }, take: 40 });
  const hasCoach = d.coaches.length > 0;

  return (
    <>
      <PageHeader eyebrow="Evidence over time" title="Development history">
        This is a record of what you practiced, who you checked in with, and what changed over time.
      </PageHeader>
      <div className="flex flex-wrap gap-3 mb-6">
        <a href="/export" className="btn-primary">Download development summary</a>
        <span className="text-sm muted self-center">Markdown. Excludes your journal and AI conversations.</span>
      </div>

      {d.assessments.length > 0 && (
        <Card>
          <p className="eyebrow">FORGE readings</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead><tr className="text-left text-ink-mute text-xs"><th className="py-2 font-medium">Date</th>{PILLAR_KEYS.map((k) => <th key={k} className="font-medium text-center">{k}</th>)}<th className="font-medium text-right">Total</th></tr></thead>
              <tbody>
                {d.assessments.map((a, i) => {
                  const s = scoresFrom(a);
                  const prev = i > 0 ? scoresFrom(d.assessments[i - 1]) : null;
                  return (
                    <tr key={a.id} className="border-t border-line">
                      <td className="py-2">{fmt(a.completedAt, { month: "short", day: "numeric", year: "numeric" })}</td>
                      {PILLAR_KEYS.map((k) => <td key={k} className="text-center">{s[k]}{prev && s[k] !== prev[k] && <span className={`ml-1 text-xs ${s[k] > prev[k] ? "text-sage" : "text-clay"}`}>{s[k] > prev[k] ? "+" : ""}{s[k] - prev[k]}</span>}</td>)}
                      <td className="text-right font-serif">{total(s)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {cycles.length > 0 && (
        <Card className="mt-5">
          <p className="eyebrow">30-day cycles</p>
          <ul className="mt-3 space-y-3">
            {cycles.map((c) => {
              const s = practiceSummary(c.checkIns);
              return (
                <li key={c.id} className="rounded-xl bg-paper p-3">
                  <p className="font-medium">{pack.pillars.find((p) => p.key === c.pillar)?.name} · {fmt(c.startDate, { month: "short", day: "numeric", year: "numeric" })}{c.seasonMonth ? ` · season month ${c.seasonMonth}` : ""}</p>
                  {c.focus && <p className="text-sm text-ink-soft">{c.focus}</p>}
                  <p className="text-sm mt-1">{s.done} done · {s.partial} partial · {s.notYet} not yet · {c.status === "COMPLETED" ? DAY30_DECISIONS[c.decision as keyof typeof DAY30_DECISIONS] : c.status.toLowerCase()}</p>
                  {c.finalReview && <p className="mt-2 text-[15px]">{c.finalReview}</p>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="mt-5">
        <p className="eyebrow">Daily reflections</p>
        {reflections.length === 0 && <p className="mt-2 text-sm muted">Nothing yet.</p>}
        <ul className="mt-3 divide-y divide-line">
          {reflections.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{fmt(r.date, { weekday: "short", month: "short", day: "numeric" })} · {CHECKIN_STATUS[r.status as keyof typeof CHECKIN_STATUS]}</span>
                <span className="flex items-center gap-3">
                  <Privacy shared={r.shared} />
                  {hasCoach && (
                    <form action={toggleEntryShared}>
                      <input type="hidden" name="kind" value="checkin" /><input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="shared" value={r.shared ? "false" : "true"} />
                      <button className="text-xs btn-link">{r.shared ? "Make private" : "Share"}</button>
                    </form>
                  )}
                </span>
              </div>
              {r.identityActed && <p className="mt-1 text-sm text-ink-soft">Showed up as who I am: {CHECKIN_IDENTITY.answers[r.identityActed as keyof typeof CHECKIN_IDENTITY.answers]}{r.identityNote ? `. ${r.identityNote}` : ""}</p>}
              {r.note && <p className="mt-1 text-[15px]">{r.note}</p>}
              {r.reflection && <p className="mt-1 text-[15px] text-ink-soft whitespace-pre-wrap">{r.reflection}</p>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
