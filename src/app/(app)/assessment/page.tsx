import { FaithCheckIn, TenPathways } from "@/components/FaithCheckIn";
import Link from "next/link";
import { NAMES } from "@/content/names";
import { withArticle } from "@/content/whoIAm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { scoresFrom } from "@/lib/forge";
import { PILLAR_KEYS } from "@/content/types";
import { fmt } from "@/lib/dates";
import { PageHeader, ChapterOpening, PillarMark, Draft, Source } from "@/components/ui";
import { DistanceStart } from "@/components/DistanceStart";
import { positionWord } from "@/lib/distance";

export const metadata = { title: "The Rules of the Road" };

export default async function AssessmentPage({ searchParams }: { searchParams: Promise<{ next?: string; retake?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const sp = await searchParams;
  // Sent here to take it again at day 30, from a focus or from the season: the results come back there.
  const retakeFor = sp.retake ? await db.developmentCycle.findFirst({ where: { id: sp.retake, userId: u.id }, select: { id: true } }) : null;
  const next = retakeFor ? `/cycle?id=${retakeFor.id}` : sp.next === "season" ? "/season" : undefined;
  const { pack, entrepreneur } = await getContent();
  const profile = await db.profile.findUnique({ where: { userId: u.id } });
  const identity = await db.identityProfile.findUnique({ where: { userId: u.id }, select: { role: true, becoming: true } });
  const statement = profile?.forgeStatement || identity?.becoming || "";
  const past = await db.assessment.findMany({ where: { userId: u.id, isSecondOpinion: false }, orderBy: { completedAt: "desc" } });
  const useEntre = profile?.pathway === "ENTREPRENEURIAL" && !!entrepreneur;

  return (
    <>
      <ChapterOpening image="/chapters/rules-of-the-road.jpg" alt="A highway seen from above, lanes and traffic" title={NAMES.rules.name} plain={NAMES.rules.plain}>
        {useEntre ? entrepreneur!.intro.filter((t) => !/measures five behaviors/i.test(t)).slice(0, 3).map((t) => <p key={t} className="mb-2">{t}</p>) : (
          <p>This measures you against your own future self: the five lines you wrote in the Driver&apos;s Seat. For each rule, you&apos;ll say how often you were that person this week, name a real moment from this week, and choose what you&apos;d do in one situation. It takes about fifteen minutes.</p>
        )}
      </ChapterOpening>

      {/* The scores are read against the identity the client claimed, so FORGE links straight through. */}
      {(statement || identity?.role) && (
        <Link href="/identity" className="glow mb-6 block rounded-[22px] p-5 sm:p-6">
          <p className="section-label">{identity?.role ? `Measured as ${withArticle(identity.role)}` : "Measured against who you claimed"}</p>
          {statement && <p className="mt-2 font-serif text-[18px] leading-snug text-heading line-clamp-3">{statement}</p>}
          <p className="mt-3 text-sm text-ink-soft">How close is the driver you were this week to the person you described?</p>
        </Link>
      )}

      {pack.assessmentStatus === "draft" && (
        <div className="card mb-6 border-alert/30 bg-alert-soft/40">
          <Draft>Draft assessment</Draft>
          <p className="mt-2 text-sm">The licensed content pack is not installed on this server, so this is a placeholder assessment for testing only. It is not the author&apos;s instrument and is not validated.</p>
        </div>
      )}

      <Link href="/feedback" className="tile mb-6 flex items-center gap-4 transition hover:-translate-y-0.5">
        <span className="flex-1">
          <span className="block text-[15px] font-medium text-heading">My feedback</span>
          <span className="block text-sm text-ink-soft">Had a 360 or an EQ-i debrief? Add your own summary and connect it to FORGE.</span>
        </span>
        <span aria-hidden className="text-ink-mute">›</span>
      </Link>

      {pack.threeNote && !useEntre && <p className="quote mb-6">{pack.threeNote}</p>}

      {next && <p role="status" className="notice mb-4">{next === "/season" ? "Take it again to see how far you've come this season. The results will take you back to the season." : "Day 30: take it again before you finish. The results will take you back to finish your 30 days."}</p>}
      <DistanceStart userId={u.id} next={next} />

      {/* Earlier readings come after the ratings, to look back on once today's is done. */}
      {past.length > 0 && (
        <div className="card mt-10">
          <p className="section-label">Previous readings</p>
          <ul className="mt-2 divide-y divide-line">
            {past.map((a) => (
              <li key={a.id} className="py-2 flex justify-between">
                <Link href={`/assessment/${a.id}`} className="btn-link">{fmt(a.completedAt, { month: "short", day: "numeric", year: "numeric" })}</Link>
                <span className="muted text-sm">{(() => { const sc = scoresFrom(a); return PILLAR_KEYS.map((k) => `${k}: ${positionWord(sc[k])}`).join(", "); })()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <TenPathways />
      <FaithCheckIn chapter={/rules of the road/i} />
    </>
  );
}
