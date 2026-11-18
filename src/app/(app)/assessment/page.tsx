import Link from "next/link";
import { NAMES } from "@/content/names";
import { withArticle } from "@/content/whoIAm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { scoresFrom } from "@/lib/forge";
import { PILLAR_KEYS } from "@/content/types";
import { fmt } from "@/lib/dates";
import { PageHeader, PillarMark, Draft, Source } from "@/components/ui";
import { AssessmentForm } from "@/components/AssessmentForm";
import { linesOf } from "@/content/forgeLines";

export const metadata = { title: "The Rules of the Road" };

export default async function AssessmentPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const u = await requireUser("PARTICIPANT");
  const { pack, entrepreneur } = await getContent();
  const profile = await db.profile.findUnique({ where: { userId: u.id } });
  const identity = await db.identityProfile.findUnique({ where: { userId: u.id }, select: { role: true, becoming: true } });
  const statement = profile?.forgeStatement || identity?.becoming || "";
  const past = await db.assessment.findMany({ where: { userId: u.id, isSecondOpinion: false }, orderBy: { completedAt: "desc" } });
  const useEntre = profile?.pathway === "ENTREPRENEURIAL" && !!entrepreneur;
  const instrument = pack.assessmentStatus === "draft" ? "FORGE_DRAFT" : useEntre ? "FORGE_ENTREPRENEUR" : "FORGE_PERSONAL";

  return (
    <>
      <PageHeader eyebrow={useEntre ? "FORGE, for entrepreneurs" : "FORGE"} title={NAMES.rules.name} plain={NAMES.rules.plain}>
        {useEntre ? entrepreneur!.intro.filter((t) => !/measures five behaviors/i.test(t)).slice(0, 3).map((t) => <p key={t} className="mb-2">{t}</p>) : (
          <p>This is the deep work of FORGE. For each rule, read what you wrote and all five levels, then choose the one that is true of you this past month. Take your time with it.</p>
        )}
      </PageHeader>

      {/* The scores are read against the identity the client claimed, so FORGE links straight through. */}
      {(statement || identity?.role) && (
        <Link href="/identity" className="glow mb-6 block rounded-[22px] p-5 sm:p-6">
          <p className="section-label">{identity?.role ? `Rate yourself as ${withArticle(identity.role)}` : "Rate yourself against who you claimed"}</p>
          {statement && <p className="mt-2 font-serif text-[18px] leading-snug text-heading line-clamp-3">{statement}</p>}
          <p className="mt-3 text-sm text-ink-soft">Score each rule as the person you described. The lowest one is where your focus goes next.</p>
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

      {past.length > 0 && (
        <div className="card mb-6">
          <p className="eyebrow">Previous readings</p>
          <ul className="mt-2 divide-y divide-line">
            {past.map((a) => (
              <li key={a.id} className="py-2 flex justify-between">
                <Link href={`/assessment/${a.id}`} className="btn-link">{fmt(a.completedAt, { month: "short", day: "numeric", year: "numeric" })}</Link>
                <span className="muted text-sm">{(() => { const sc = scoresFrom(a); return PILLAR_KEYS.map((k) => `${k} ${sc[k]}`).join(", "); })()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pack.threeNote && !useEntre && <p className="quote mb-6">{pack.threeNote}</p>}

      <AssessmentForm pack={pack} entrepreneur={entrepreneur} useEntre={useEntre} instrument={instrument} next={next === "season" ? "/season" : undefined} lines={linesOf(profile)} role={identity?.role} />
    </>
  );
}
