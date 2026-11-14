import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmt } from "@/lib/dates";
import { FEEDBACK_SOURCES, FEEDBACK_COPY } from "@/content/feedback";
import type { PillarKey } from "@/content/types";
import { PageHeader, PillarMark, Empty } from "@/components/ui";

export const metadata = { title: "My feedback" };

/**
 * My feedback: the client's own summaries of a 360, an EQ-i debrief or other feedback.
 * EQ-i priorities entered before this page existed move into one "EQ-i 2.0 debrief" entry, untouched.
 */
export default async function FeedbackList() {
  const u = await requireUser("PARTICIPANT");
  const loose = await db.eqiPriority.count({ where: { userId: u.id, feedbackId: null } });
  if (loose) {
    const f = await db.feedback.create({ data: { userId: u.id, source: "EQI", title: "EQ-i 2.0 debrief", ownSummary: true } });
    await db.eqiPriority.updateMany({ where: { userId: u.id, feedbackId: null }, data: { feedbackId: f.id } });
  }
  const items = await db.feedback.findMany({
    where: { userId: u.id },
    orderBy: [{ takenOn: "desc" }, { createdAt: "desc" }],
    select: { id: true, source: true, title: true, takenOn: true, createdAt: true, pillars: true, shareCoach: true, allowAi: true, fileName: true, _count: { select: { priorities: true } } },
  });
  return (
    <>
      <PageHeader eyebrow="Where I am" title="My feedback">{FEEDBACK_COPY.intro}</PageHeader>
      {items.length === 0 ? (
        <Empty title="Nothing here yet" href="/feedback/new" cta="Add feedback">Had a 360 or an EQ-i debrief? Add your own summary and connect it to FORGE.</Empty>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((f) => {
              const pillars = JSON.parse(f.pillars || "[]") as PillarKey[];
              return (
                <li key={f.id}>
                  <Link href={`/feedback/${f.id}`} className="tile block transition hover:-translate-y-0.5">
                    <p className="text-[16px] font-medium text-heading">{f.title}</p>
                    <p className="text-sm text-ink-mute">
                      {FEEDBACK_SOURCES[f.source as keyof typeof FEEDBACK_SOURCES] ?? f.source}
                      {f.takenOn ? ` · ${fmt(f.takenOn, { month: "long", year: "numeric" })}` : ""}
                      {f._count.priorities ? ` · working on ${f._count.priorities}` : ""}
                      {f.fileName ? " · file attached" : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="chip">{f.shareCoach ? "Shared with my coach" : "Private"}</span>
                      {f.allowAi && <span className="chip">AI can use my summary</span>}
                      {pillars.map((k) => <PillarMark key={k} k={k} size="sm" />)}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link href="/feedback/new" className="btn-primary mt-6 inline-flex">Add feedback</Link>
        </>
      )}
      <p className="mt-10 max-w-2xl text-xs text-ink-mute">{FEEDBACK_COPY.publisherNote}</p>
    </>
  );
}
