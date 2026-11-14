import { cyclePosition } from "@/lib/cycle";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { PATHWAYS } from "@/content/program";
import { CYCLE_TEMPLATES, cycleWeeks } from "@/lib/cycle";
import { startCycle } from "@/app/actions/participant";
import { ymd } from "@/lib/dates";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { CycleFocusFields } from "@/components/CycleFocusFields";
import Link from "next/link";
import { activeSeason, nextMonth } from "@/lib/season";
import { SEASON_LENGTH } from "@/content/program";
import type { PillarKey } from "@/content/types";

export const metadata = { title: "Start a 30-day cycle" };

export default async function NewCycle({ searchParams }: { searchParams: Promise<{ pillar?: string; focus?: string; season?: string }> }) {
  const sp = await searchParams;
  const fromLink = ["F", "O", "R", "G", "E"].includes(sp.pillar ?? "") ? (sp.pillar as PillarKey) : null;
  const u = await requireUser("PARTICIPANT");
  const { pack } = await getContent();
  const profile = await db.profile.findUnique({ where: { userId: u.id } });
  const identity = await db.identityProfile.findUnique({ where: { userId: u.id }, select: { behavior: true, role: true } });
  const pathway = PATHWAYS[(profile?.pathway ?? "PERSONAL") as keyof typeof PATHWAYS];
  const defaultTemplate = pack.thirtyDayPlan.length ? pathway.cycleTemplate : "NIRS_30";
  const [open, coaches] = await Promise.all([activeSeason(u.id), db.coachAssignment.count({ where: { participantId: u.id, active: true } })]);
  const month = open ? nextMonth(open.cycles.length) : null;
  const continuing = !!(open && month && sp.season !== "none");
  // Starting a new 30 days ends one that is running. Say so before the client starts.
  const running = await db.developmentCycle.findFirst({ where: { userId: u.id, status: "ACTIVE" }, orderBy: { startDate: "desc" }, select: { startDate: true } });
  const runningPos = running ? cyclePosition(running.startDate) : null;
  return (
    <>
      <PageHeader eyebrow="Discipline by Design" title="Start your 30 days">Pick one pillar. Then name the moment you want to change and what you'll do instead. Checking in takes two minutes a day.</PageHeader>
      {runningPos && !runningPos.finished && (
        <p role="note" className="mb-5 rounded-2xl bg-gold-soft px-4 py-3 text-[15px] text-ink">
          You&apos;re on day {runningPos.day} of your current 30 days. Starting a new one ends it. Your check-ins are kept.{" "}
          <Link href="/cycle" className="btn-link">Keep my current 30 days</Link>
          {sp.focus ? <> or <Link href="/feedback" className="btn-link">add it to My road for now</Link></> : null}.
        </p>
      )}
      <Card>
        <form action={startCycle} className="space-y-5">
          <div>
            <label htmlFor="role" className="label">{identity?.role ? "Still about me as..." : "The role this 30 days is about"}</label>
            <div className="flex items-center inputbox">
              <span className="pl-3.5 pr-1.5 py-2.5 text-[15px] text-ink-soft whitespace-nowrap">This is about me as</span>
              <input id="role" name="role" defaultValue={identity?.role ?? ""} maxLength={80} placeholder="manager" className="flex-1 min-w-0 bg-transparent py-2.5 pr-3 text-[15px] focus:outline-none" />
            </div>
            <p className="mt-1 text-xs text-ink-mute">One role for each 30 days. Change it here if this month is about a different one.</p>
          </div>
          <CycleFocusFields pillars={pack.pillars.map((p) => ({ key: p.key, name: p.name }))} initial={fromLink ?? ((profile?.priorityPillar ?? "F") as PillarKey)} initialFocus={(sp.focus ?? "").slice(0, 500)} identityBehavior={identity?.behavior.split("\n")[0].slice(0, 300) ?? ""} />
          {continuing ? (
            <div className="rounded-xl border border-line bg-paper px-4 py-3">
              <input type="hidden" name="season" value="continue" />
              <p className="font-medium">Month {month} of {SEASON_LENGTH} in my season</p>
              <p className="text-sm text-ink-soft mt-0.5">{open!.cycles.map((c, i) => `Month ${i + 1}: ${pack.pillars.find((p) => p.key === c.pillar)?.name ?? c.pillar}`).join(" · ")}</p>
              <Link href="/cycle/new?season=none" className="mt-1 inline-block text-xs text-ink-mute hover:text-ink">Start this one outside the season</Link>
            </div>
          ) : (
            <label className="option !flex items-start gap-3 !py-3 cursor-pointer">
              <input type="checkbox" name="season" value="new" defaultChecked={sp.season === "new" || (coaches > 0 && sp.season !== "none")} className="mt-1 h-4 w-4 accent-navy" />
              <span><span className="font-medium">Make this month 1 of a 90-day season</span><span className="block text-sm text-ink-soft">Three 30-day cycles back to back, with a review at the end.</span></span>
            </label>
          )}
          <details className="rounded-xl bg-paper px-3 py-2">
            <summary className="cursor-pointer text-sm text-link">Structure and start date</summary>
            <fieldset className="mt-3">
              <legend className="sr-only">Structure</legend>
              <div className="space-y-2">
                {(Object.keys(CYCLE_TEMPLATES) as (keyof typeof CYCLE_TEMPLATES)[]).map((k) => {
                  const t = CYCLE_TEMPLATES[k];
                  const w = cycleWeeks(k, pack).weeks;
                  if (k === "WORKBOOK_30" && !pack.thirtyDayPlan.length) return null;
                  return (
                    <label key={k} className="option !flex gap-3 !p-3 cursor-pointer">
                      <input type="radio" name="template" value={k} defaultChecked={k === defaultTemplate} className="mt-1 accent-navy" />
                      <span>
                        <span className="font-medium text-[15px]">{w.map((x) => x.phase).join(" · ")}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <Field label="Start date"><input type="date" name="startDate" defaultValue={ymd()} className="input max-w-[200px]" /></Field>
          </details>
          <Submit>{runningPos && !runningPos.finished ? "Start anyway" : "Start the cycle"}</Submit>
        </form>
      </Card>
    </>
  );
}
