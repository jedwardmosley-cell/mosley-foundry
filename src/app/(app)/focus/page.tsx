import { FaithCheckIn } from "@/components/FaithCheckIn";
import Link from "next/link";
import { NAMES } from "@/content/names";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { cyclePosition } from "@/lib/cycle";
import { activeFocuses } from "@/lib/focusData";
import { focusTitle, MAX_FOCUSES } from "@/lib/focus";
import { fmt } from "@/lib/dates";
import type { PillarKey } from "@/content/types";
import { PageHeader, ChapterOpening, PillarMark } from "@/components/ui";

export const metadata = { title: "The Windshield" };

/**
 * My focus: the one or two development opportunities the client is working on, and nothing else.
 */
export default async function FocusPage() {
  const u = await requireUser("PARTICIPANT");
  const { pack } = await getContent();
  const [focuses, assessment, profile, identity, finished] = await Promise.all([
    activeFocuses(u.id),
    db.assessment.findFirst({ where: { userId: u.id, isSecondOpinion: false }, orderBy: { completedAt: "desc" } }),
    db.profile.findUnique({ where: { userId: u.id }, select: { forgeStatement: true, destination: true, priorityPillar: true } }),
    db.identityProfile.findUnique({ where: { userId: u.id }, select: { becoming: true } }),
    db.developmentCycle.findMany({ where: { userId: u.id, status: { in: ["COMPLETED", "STOPPED"] } }, orderBy: { startDate: "desc" }, take: 4 }),
  ]);
  const name = (k: string) => pack.pillars.find((p) => p.key === k)?.name ?? k;
  const statement = profile?.forgeStatement || identity?.becoming || profile?.destination || "";

  return (
    <>
      <ChapterOpening image="/chapters/road-ahead.jpg" alt="The open road ahead, from behind the wheel" title={NAMES.windshield.name} plain={NAMES.windshield.plain}>
        One or two things to work on, and that&apos;s it. Each one moves you toward who&apos;s behind the wheel.
      </ChapterOpening>

      {statement && (
        <Link href="/identity" className="mb-6 block rounded-2xl bg-ink/[0.04] px-5 py-4 transition hover:bg-ink/[0.06]">
          <p className="text-xs text-ink-mute">Who&apos;s behind the wheel</p>
          <p className="mt-1 font-serif text-[17px] leading-snug text-heading line-clamp-3">{statement}</p>
        </Link>
      )}

      <h2 className="sr-only">My focuses</h2>
      <div className="space-y-3">
        {focuses.map((f, i) => {
          const pos = cyclePosition(f.startDate);
          return (
            <Link key={f.id} href={f.setupDoneAt ? `/cycle?id=${f.id}` : "/cycle/setup?step=1"} className="card block !p-5 sm:!p-6 transition hover:-translate-y-0.5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-book italic text-[16px] text-ink-soft">Focus {i + 1}</p>
                <span className="chip">{pos.finished ? "Day 30" : `Day ${pos.day} of 30`}</span>
              </div>
              <p className="mt-2 flex items-start gap-2.5 text-[18px] font-medium leading-snug text-heading">
                <PillarMark k={f.pillar as PillarKey} size="sm" />{focusTitle(f)}
              </p>
              {f.plan ? <p className="mt-2 text-[15px] text-ink-soft">{f.plan}</p> : <p className="mt-2 text-[15px] text-link">Finish setting it up: five short questions and who finds out</p>}
            </Link>
          );
        })}

        {focuses.length < MAX_FOCUSES && (
          <Link href="/cycle/new" className="block rounded-[22px] border-2 border-dashed border-ink/15 px-5 py-6 text-center transition hover:border-ink/30">
            <p className="text-[16px] font-medium text-heading">{focuses.length === 0 ? "Choose your first focus" : "Add a second focus"}</p>
            <p className="mt-1 text-sm text-ink-soft">{focuses.length === 0 ? "One is plenty. Two is the most." : "Optional. Two is the most, so this would be the last one."}</p>
          </Link>
        )}
        {focuses.length >= MAX_FOCUSES && <p className="px-1 text-sm text-ink-mute">Two focuses is the most. A new one can come in when one finishes, or by replacing one.</p>}
      </div>

      {finished.length > 0 && (
        <section className="mt-10">
          <h2 className="h3 mb-3">Finished</h2>
          <ul className="space-y-2">
            {finished.map((f) => (
              <li key={f.id} className="flex items-center gap-3 text-[15px]">
                <PillarMark k={f.pillar as PillarKey} size="sm" />
                <span className="flex-1">{focusTitle(f)}</span>
                <span className="text-sm text-ink-mute">{fmt(f.startDate, { month: "short", year: "numeric" })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <FaithCheckIn chapter={/windshield/i} />
    </>
  );
}
