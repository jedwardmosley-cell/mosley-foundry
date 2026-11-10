import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { PATHWAYS } from "@/content/program";
import { CYCLE_TEMPLATES, cycleWeeks } from "@/lib/cycle";
import { startCycle } from "@/app/actions/participant";
import { ymd } from "@/lib/dates";
import { PageHeader, Card, Field, PillarMark, Draft } from "@/components/ui";
import { Submit } from "@/components/Submit";

export const metadata = { title: "Start a 30-day cycle" };

export default async function NewCycle() {
  const u = await requireUser("PARTICIPANT");
  const { pack } = await getContent();
  const profile = await db.profile.findUnique({ where: { userId: u.id } });
  const pathway = PATHWAYS[(profile?.pathway ?? "PERSONAL") as keyof typeof PATHWAYS];
  const defaultTemplate = pack.thirtyDayPlan.length ? pathway.cycleTemplate : "NIRS_30";
  return (
    <>
      <PageHeader eyebrow="30-day development cycle" title="Four weeks of specific work. One decision on Day 30.">
        Insight without structure fades. Pick one pillar and one behavior. A daily check-in takes two minutes.
      </PageHeader>
      <Card>
        <form action={startCycle} className="space-y-5">
          <fieldset>
            <legend className="label">Pillar</legend>
            <div className="grid grid-cols-5 gap-2">
              {pack.pillars.map((p) => (
                <label key={p.key} className="cursor-pointer">
                  <input type="radio" name="pillar" value={p.key} defaultChecked={(profile?.priorityPillar ?? "F") === p.key} className="peer sr-only" />
                  <span className="flex flex-col items-center gap-1 rounded-xl border border-line bg-white py-3 peer-checked:border-navy peer-checked:ring-2 peer-checked:ring-navy/20">
                    <PillarMark k={p.key} size="sm" /><span className="text-[11px] text-center leading-tight px-1">{p.name}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="The behavior you are working on" hint="Specific. Not a category. The situation and what you do in it.">
            <input name="focus" className="input" maxLength={500} placeholder="e.g. Pausing before I answer when a decision gets challenged" />
          </Field>
          <fieldset>
            <legend className="label">Structure</legend>
            <div className="space-y-3">
              {(Object.keys(CYCLE_TEMPLATES) as (keyof typeof CYCLE_TEMPLATES)[]).map((k) => {
                const t = CYCLE_TEMPLATES[k];
                const w = cycleWeeks(k, pack).weeks;
                if (k === "WORKBOOK_30" && !pack.thirtyDayPlan.length) return null;
                return (
                  <label key={k} className="flex gap-3 rounded-xl border border-line bg-white p-4 cursor-pointer has-[:checked]:border-navy">
                    <input type="radio" name="template" value={k} defaultChecked={k === defaultTemplate} className="mt-1 accent-navy" />
                    <span>
                      <span className="font-medium">{t.name}</span> {w[0]?.status !== "source" && <Draft>Assignments pending source</Draft>}
                      <span className="block text-sm muted">{w.map((x) => x.phase).join(" · ")}</span>
                      <span className="block text-xs text-ink-mute mt-1">{t.source}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <Field label="Start date"><input type="date" name="startDate" defaultValue={ymd()} className="input max-w-[200px]" /></Field>
          <Submit>Start the cycle</Submit>
        </form>
      </Card>
    </>
  );
}
