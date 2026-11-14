import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { PATHWAYS, SEGMENTS, DELIVERY_FORMATS } from "@/content/program";
import { choosePathway } from "@/app/actions/participant";
import { fmt, addDays, daysBetween } from "@/lib/dates";
import { PageHeader, Card, PillarMark, Source } from "@/components/ui";

export const metadata = { title: "My pathway" };

export default async function PathwayPage() {
  const u = await requireUser("PARTICIPANT");
  const { entrepreneur } = await getContent();
  const profile = await db.profile.findUniqueOrThrow({ where: { userId: u.id } });
  const pathway = PATHWAYS[profile.pathway as keyof typeof PATHWAYS];
  const membership = await db.cohortMember.findFirst({
    where: { userId: u.id, role: "PARTICIPANT" },
    include: { cohort: { include: { sessions: { orderBy: { startsAt: "asc" }, include: { attendance: { where: { userId: u.id } } } } } } },
  });
  const goals = await db.developmentGoal.findMany({ where: { userId: u.id, segmentKey: { not: null } } });

  return (
    <>
      <PageHeader eyebrow="Pathway" title={pathway.name}>{pathway.line}</PageHeader>

      {profile.pathway === "LEADING_OTHERS" && (
        <>
          {membership && (
            <Card className="mb-5">
              <p className="eyebrow">My cohort</p>
              <h2 className="h2 mt-1">{membership.cohort.name}</h2>
              <p className="text-sm muted mt-1">{DELIVERY_FORMATS[membership.cohort.deliveryFormat as keyof typeof DELIVERY_FORMATS].label}</p>
              {(() => {
                const last = membership.cohort.sessions.at(-1)?.startsAt;
                if (!last) return null;
                const end = addDays(last, membership.cohort.reinforceDays);
                const left = daysBetween(new Date(), end);
                return <p className="mt-2 text-sm">Reinforcement runs {membership.cohort.reinforceDays} days after the last segment, through {fmt(end, { month: "long", day: "numeric" })}{left >= 0 ? ` (${left} days left)` : ""}.</p>;
              })()}
            </Card>
          )}
          <div className="space-y-3">
            {SEGMENTS.map((s) => {
              const sess = membership?.cohort.sessions.find((x) => x.segmentKey === s.key);
              const att = sess?.attendance[0]?.status;
              const hasGoal = goals.some((g) => g.segmentKey === s.key);
              return (
                <Link key={s.key} href={`/pathway/segment/${s.key}`} className="card block hover:border-navy/40">
                  <div className="flex items-start gap-4">
                    <span className="font-serif text-2xl text-ink-mute w-8">{s.key}</span>
                    <div className="flex-1">
                      <h2 className="h3">{s.title}</h2>
                      <p className="text-[14px] text-ink-soft mt-1">{s.summary}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs muted">
                        {s.pillars.map((k) => <PillarMark key={k} k={k} size="sm" />)}
                        {sess && <span>{fmt(sess.startsAt, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
                        {att && <span className="chip">{att.toLowerCase()}</span>}
                        {hasGoal && <span className="chip !text-link">goal set</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {profile.pathway === "ENTREPRENEURIAL" && entrepreneur && (
        <Card>
          <p className="eyebrow">Stop ideating. Start building.</p>
          <h2 className="h2 mt-1">Build the business you&apos;d buy</h2>
          <p className="mt-3 text-[15px] font-medium">{entrepreneur.owner.sellableTest}</p>
          <ul className="mt-4 space-y-3">
            {entrepreneur.owner.fourBuilds.map((b) => (
              <li key={b.key} className="rounded-xl bg-paper p-4">
                <p className="font-medium">{b.label}</p>
                <p className="text-sm text-ink-soft">{b.detail}</p>
                <p className="mt-2 text-[15px]">{b.signal}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[15px]">{entrepreneur.owner.howToBuild}</p>
          <p className="mt-4 text-sm"><Link href="/road" className="btn-link">Put your first build on My road</Link> under Leadership responsibilities.</p>
          <Source>{entrepreneur.owner.source}</Source>
        </Card>
      )}

      {profile.pathway === "PERSONAL" && (
        <Card>
          <p className="text-[15px]">Your pathway runs on the core: the FORGE assessment, your FORGE plan, My road (Discipline by Design), your people, and 30-day cycles. The <Link href="/library" className="btn-link">Library</Link> has the FORGE guide and exercises.</p>
        </Card>
      )}

      <Link href="/feedback" className="card block mt-5 hover:border-navy/40">
        <h2 className="h3">My feedback</h2>
        <p className="text-sm muted mt-1">Had a 360 or an EQ-i debrief? Add your own summary and connect it to a FORGE pillar, a practice and your 30 days.</p>
      </Link>

      <Card className="mt-8">
        <p className="eyebrow">Change pathway</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.values(PATHWAYS).filter((p) => p.key !== profile.pathway).map((p) => (
            <form key={p.key} action={choosePathway}><input type="hidden" name="pathway" value={p.key} /><button className="btn-quiet">{p.name}</button></form>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-mute">Switching takes you to a fresh assessment for that pathway. Your history stays.</p>
      </Card>
    </>
  );
}
