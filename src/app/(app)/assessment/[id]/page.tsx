import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { scoresFrom } from "@/lib/forge";
import { fmt } from "@/lib/dates";
import { PILLAR_KEYS } from "@/content/types";
import { PageHeader, PillarMark } from "@/components/ui";
import { linesOf } from "@/content/forgeLines";
import { positionWord } from "@/lib/distance";

export const metadata = { title: "Where I was" };

/**
 * An earlier reading. One from the distance check opens its own results. One from the older self-rating shows
 * each rule as the matching answer, in words, never as a number.
 */
export default async function AssessmentResult({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { id } = await params;
  const a = await db.assessment.findFirst({ where: { id, userId: u.id } });
  if (!a) notFound();
  const run = await db.distanceRun.findFirst({ where: { assessmentId: a.id, userId: u.id }, select: { id: true } });
  if (run) redirect(`/assessment/check/${run.id}/done`);
  const [profile, { pack }] = await Promise.all([db.profile.findUnique({ where: { userId: u.id } }), getContent()]);
  const s = scoresFrom(a);
  const lines = linesOf(profile);

  return (
    <>
      <PageHeader eyebrow={fmt(a.completedAt, { month: "long", day: "numeric", year: "numeric" })} title="Where I was">
        From the older self-rating, shown in the words used now.
      </PageHeader>
      <ol className="divide-y divide-line/60 border-y border-line/60">
        {PILLAR_KEYS.map((k) => (
          <li key={k} className="flex items-start gap-3.5 py-4">
            <PillarMark k={k} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink-mute">{pack.pillars.find((p) => p.key === k)?.name}</span>
              <span className="block font-book text-[21px] leading-tight text-heading">{positionWord(s[k])}</span>
              {lines[k] && <span className="mt-1 block text-[14px] text-ink-soft line-clamp-2">{lines[k]}</span>}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-ink-mute">FORGE is a development tool. It isn&apos;t a validated psychometric measure, and it can&apos;t be compared to EQ-i results.</p>
      <Link href="/assessment" className="btn-primary mt-6 inline-flex">Take Where I am now</Link>
    </>
  );
}
