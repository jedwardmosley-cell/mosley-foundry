import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { SEGMENTS, BLUEPRINT_AREAS } from "@/content/program";
import { saveGoal, addCommitment } from "@/app/actions/participant";
import { PageHeader, Card, PillarMark, Draft, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { Picks } from "@/components/Picks";
import { ONE_MOVE, BLUEPRINT_PICKS } from "@/content/options";

export default async function SegmentPage({ params }: { params: Promise<{ key: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { key } = await params;
  const s = SEGMENTS.find((x) => x.key === key);
  if (!s) notFound();
  const { pack } = await getContent();
  const goal = await db.developmentGoal.findFirst({ where: { userId: u.id, segmentKey: s.key } });
  const area = BLUEPRINT_AREAS.find((a) => a.key === s.commitmentArea)!;
  const leading = key === "04" ? pack.discipline.leadingOthers : [];
  return (
    <>
      <PageHeader eyebrow={`Leading Others · Segment ${s.key}`} title={s.title}>{s.summary}</PageHeader>
      <Card>
        <p className="eyebrow">Connected FORGE principles</p>
        <ul className="mt-3 space-y-3">
          {s.pillars.map((k) => {
            const p = pack.pillars.find((x) => x.key === k)!;
            return <li key={k} className="flex items-center gap-3"><PillarMark k={k} /><span><span className="font-medium">{p.name}.</span> <span className="muted">{p.short}</span></span></li>;
          })}
        </ul>
      </Card>
      {leading.length > 0 && (
        <Card className="mt-5">
          <p className="eyebrow">From Ch. 10, Discipline by Design</p>
          {leading.slice(0, 6).map((t) => <p key={t} className="mt-3 text-[15px] leading-relaxed">{t}</p>)}
        </Card>
      )}
      <Card className="mt-5">
        <div className="flex items-center gap-2"><p className="eyebrow">Practice</p><Draft /></div>
        <p className="mt-2 text-[15px] leading-relaxed">{s.practice.text}</p>
      </Card>
      <Card className="mt-5">
        <h2 className="h3">My development goal for this segment</h2>
        <form action={saveGoal} className="mt-4 space-y-4">
          <input type="hidden" name="pillar" value={s.pillars[0]} />
          <input type="hidden" name="segmentKey" value={s.key} />
          <Field label="One move this week"><input name="oneMove" defaultValue={goal?.oneMove} className="input" /></Field>
          <Picks list={ONE_MOVE[s.pillars[0]]} target="oneMove" />
          <details open={!!(goal?.whereNow || goal?.whereWant)}>
            <summary className="cursor-pointer text-sm text-link">Where I am now and where I want to be <span className="text-ink-mute">(optional)</span></summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Where I am now"><textarea name="whereNow" defaultValue={goal?.whereNow} className="textarea !min-h-[80px]" /></Field>
              <Field label="Where I want to be"><textarea name="whereWant" defaultValue={goal?.whereWant} className="textarea !min-h-[80px]" /></Field>
            </div>
          </details>
          <Submit className="btn-quiet">Save goal</Submit>
        </form>
      </Card>
      <Card className="mt-5">
        <h2 className="h3">Turn it into a Discipline by Design commitment</h2>
        <p className="text-sm muted mt-1">Goes into your blueprint under {area.label.toLowerCase()}.</p>
        <form action={addCommitment} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="area" value={area.key} />
          <input type="hidden" name="detail" value={`Segment ${s.key}: ${s.title}`} />
          <div className="sm:col-span-2">
            <Field label="Commitment"><input name="title" required className="input" /></Field>
            {BLUEPRINT_PICKS[area.key] && <Picks list={BLUEPRINT_PICKS[area.key]} target="title" />}
          </div>
          <Field label="When (optional)"><input name="when" className="input" /></Field>
          <input type="hidden" name="cadence" value="WEEKLY" />
          <div className="sm:col-span-2"><Submit className="btn-quiet">Add to blueprint</Submit></div>
        </form>
      </Card>
    </>
  );
}
