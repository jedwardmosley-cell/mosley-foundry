import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { scoresFrom } from "@/lib/forge";
import { practiceSummary } from "@/lib/cycle";
import { fmt } from "@/lib/dates";
import { completeSeason } from "@/app/actions/participant";
import { PageHeader, Card, PillarMark, Empty } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { ReadTheBook } from "@/components/ReadTheBook";
import { DAY30_DECISIONS, SEASON_DECISIONS, SEASON_LENGTH } from "@/content/program";
import type { PillarKey } from "@/content/types";

export const metadata = { title: "My season" };

/** The season review: three months side by side, scores then and now, and the client's call on what comes next. */
export default async function SeasonPage() {
  const u = await requireUser("PARTICIPANT");
  const { pack } = await getContent();
  const seasons = await db.season.findMany({
    where: { userId: u.id },
    orderBy: { startedAt: "desc" },
    include: { cycles: { orderBy: { startDate: "asc" }, include: { checkIns: { select: { status: true } } } } },
  });
  const season = seasons[0];
  if (!season) {
    return (
      <>
        <PageHeader eyebrow="Discipline by Design" title="Seasons" />
        <Empty title="No season yet" href="/cycle/new?season=new" cta="Start a season">A season is three 30-day cycles back to back, about 90 days, with a review at the end.</Empty>
      </>
    );
  }

  const [start, latest, identity, profile] = await Promise.all([
    season.startAssessmentId ? db.assessment.findUnique({ where: { id: season.startAssessmentId } }) : null,
    db.assessment.findFirst({ where: { userId: u.id, isSecondOpinion: false }, orderBy: { completedAt: "desc" } }),
    db.identityProfile.findUnique({ where: { userId: u.id }, select: { becoming: true } }),
    db.profile.findUnique({ where: { userId: u.id }, select: { destination: true } }),
  ]);
  const retaken = !!(latest && latest.completedAt > season.startedAt && latest.id !== start?.id);
  const before = start ? scoresFrom(start) : null;
  const now = retaken && latest ? scoresFrom(latest) : null;
  const statementNow = identity?.becoming || profile?.destination || "";
  const name = (k: string) => pack.pillars.find((p) => p.key === k)?.name ?? k;
  const open = season.status === "ACTIVE";
  const inProgress = season.cycles.find((c) => c.status === "ACTIVE");

  return (
    <>
      <PageHeader eyebrow="Discipline by Design" title={open ? "My season" : "My last season"}>
        Started {fmt(season.startedAt, { month: "long", day: "numeric" })}{season.completedAt ? `, closed ${fmt(season.completedAt, { month: "long", day: "numeric" })}` : ""}.
      </PageHeader>

      <Card className="!p-0">
        <ul className="divide-y divide-line">
          {Array.from({ length: SEASON_LENGTH }, (_, i) => {
            const c = season.cycles.find((x) => x.seasonMonth === i + 1);
            const s = c ? practiceSummary(c.checkIns) : null;
            return (
              <li key={i} className="px-5 py-3.5 flex items-start gap-3">
                {c ? <PillarMark k={c.pillar as PillarKey} size="sm" /> : <span className="h-6 w-6 rounded-full border border-dashed border-line" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px]"><span className="font-medium">Month {i + 1}</span>{c ? ` · ${name(c.pillar)}` : ""}</p>
                  {c ? (
                    <p className="text-sm text-ink-soft">{c.focus}{s ? ` · ${s.done} done, ${s.partial} partial` : ""}{c.decision ? ` · ${DAY30_DECISIONS[c.decision as keyof typeof DAY30_DECISIONS] ?? ""}` : c.status === "ACTIVE" ? " · in progress" : ""}</p>
                  ) : <p className="text-sm text-ink-mute">{open ? "Not started" : "Skipped"}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mt-5">
        <p className="eyebrow">FORGE scores</p>
        {before && now ? (
          <ul className="mt-3 grid grid-cols-5 gap-2 text-center">
            {(Object.keys(before) as PillarKey[]).map((k) => (
              <li key={k} className="rounded-xl bg-paper py-2">
                <PillarMark k={k} size="sm" />
                <p className="mt-1 text-sm"><span className="text-ink-mute">{before[k]}</span> → <span className="font-semibold">{now[k]}</span></p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2">
            <p className="text-[15px]">{before ? "See how far you've come. Score the five pillars again, then come back here." : "Score the five pillars to see where you are now."}</p>
            <Link href="/assessment?next=season" className="btn-quiet mt-3 inline-flex">Take the FORGE assessment</Link>
          </div>
        )}
      </Card>

      {(season.startStatement || statementNow) && (
        <Card className="mt-5">
          <p className="eyebrow">Who's behind the wheel</p>
          {season.startStatement && season.startStatement !== statementNow && <p className="mt-2 text-sm text-ink-mute">At the start: {season.startStatement}</p>}
          <p className="mt-2 font-serif text-lg leading-snug">{statementNow || season.startStatement}</p>
          <p className="mt-2 text-sm text-ink-soft">Is it still true? <Link href="/identity" className="btn-link">Update it</Link> if it has grown.</p>
        </Card>
      )}

      {open && inProgress ? (
        <p className="mt-5 text-sm text-ink-soft">The review opens when month {inProgress.seasonMonth} ends. On day 30 you can go on to the next month or end the season there.</p>
      ) : open ? (
        <Card className="mt-5">
          <form action={completeSeason} className="space-y-4">
            <input type="hidden" name="id" value={season.id} />
            <label className="block">
              <span className="label">What changed in these 90 days? <span className="font-normal text-ink-mute">(optional)</span></span>
              <textarea name="review" className="textarea !min-h-[96px]" maxLength={6000} />
            </label>
            <fieldset className="space-y-2">
              <legend className="label">What comes next</legend>
              {Object.entries(SEASON_DECISIONS).map(([k, v]) => (
                <label key={k} className="flex items-center gap-2 text-[15px]"><input type="radio" name="decision" value={k} required className="accent-navy" />{v}</label>
              ))}
            </fieldset>
            <Submit>Close the season</Submit>
          </form>
        </Card>
      ) : (
        <Card className="mt-5">
          <p className="eyebrow">You decided</p>
          <p className="mt-2 text-[15px]">{SEASON_DECISIONS[season.decision as keyof typeof SEASON_DECISIONS] ?? "Closed"}</p>
          {season.review && <p className="mt-2 text-sm text-ink-soft whitespace-pre-line">{season.review}</p>}
          <Link href="/cycle/new?season=new" className="btn-quiet mt-4 inline-flex">Start a new season</Link>
        </Card>
      )}

      <ReadTheBook kind="deeper" className="mt-5" />

      {seasons.length > 1 && (
        <Card className="mt-5">
          <p className="eyebrow">Earlier seasons</p>
          <ul className="mt-2 divide-y divide-line">
            {seasons.slice(1).map((s) => (
              <li key={s.id} className="py-2 flex justify-between gap-3 text-[15px]">
                <span>{fmt(s.startedAt, { month: "short", day: "numeric", year: "numeric" })} · {s.cycles.map((c) => c.pillar).join(", ")}</span>
                <span className="text-sm text-ink-mute">{SEASON_DECISIONS[s.decision as keyof typeof SEASON_DECISIONS] ?? s.status.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
