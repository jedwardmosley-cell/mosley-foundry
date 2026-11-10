import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { saveGoal, saveStatement } from "@/app/actions/participant";
import { PageHeader, Card, PillarMark, Source, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";

export const metadata = { title: "FORGE Plan" };

export default async function PlanPage() {
  const u = await requireUser("PARTICIPANT");
  const { pack, entrepreneur } = await getContent();
  const [profile, goals] = await Promise.all([
    db.profile.findUnique({ where: { userId: u.id } }),
    db.developmentGoal.findMany({ where: { userId: u.id, status: "ACTIVE", segmentKey: null } }),
  ]);
  const entre = profile?.pathway === "ENTREPRENEURIAL" && entrepreneur;
  const roadTest = pack.chapters.find((c) => c.number === 9)?.roadTest ?? [];
  const rt = (k: string) => roadTest.find((l) => l.startsWith(`${k}:`))?.slice(3);

  return (
    <>
      <PageHeader eyebrow="Section Six" title="Your FORGE Action Plan">{pack.actionPlanIntro}</PageHeader>

      <Card>
        <form action={saveStatement} className="space-y-5">
          <Field label="Destination" hint={rt("F") ?? "Picture the leader you are becoming."}>
            <textarea name="destination" defaultValue={profile?.destination} className="textarea" maxLength={3000} />
          </Field>
          <Field label="Why" hint={rt("R") ?? "Why does the trip matter?"}>
            <textarea name="why" defaultValue={profile?.why} className="textarea !min-h-[64px]" maxLength={1000} />
          </Field>
          <Field label="FORGE Statement" hint={entre ? entrepreneur.forgeStatementPrompt : pack.forgeStatementPrompt}>
            <textarea name="forgeStatement" defaultValue={profile?.forgeStatement} className="textarea min-h-[140px]" maxLength={3000} />
          </Field>
          {pack.holdYourself && <p className="quote text-[15px]">{pack.holdYourself}</p>}
          <Submit>Save</Submit>
        </form>
        <Source>Both Hands on the Wheel, Ch. 9 Road Test; Personal Application Workbook, Section Six</Source>
      </Card>

      <div className="mt-6 space-y-4">
        {pack.pillars.map((p) => {
          const g = goals.find((x) => x.pillar === p.key);
          const isPriority = profile?.priorityPillar === p.key;
          return (
            <Card key={p.key} className={isPriority ? "border-navy/40 ring-1 ring-navy/10" : ""}>
              <form action={saveGoal} className="space-y-4">
                <input type="hidden" name="pillar" value={p.key} />
                <div className="flex items-center gap-3">
                  <PillarMark k={p.key} />
                  <div className="flex-1"><h2 className="h3">{p.name}</h2><p className="text-sm muted">{p.short}</p></div>
                  {isPriority && <span className="chip !border-navy/30 !text-navy">Priority</span>}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Where I am now"><textarea name="whereNow" defaultValue={g?.whereNow} className="textarea !min-h-[80px]" maxLength={1500} /></Field>
                  <Field label="Where I want to be"><textarea name="whereWant" defaultValue={g?.whereWant} className="textarea !min-h-[80px]" maxLength={1500} /></Field>
                  <Field label="One move this week"><textarea name="oneMove" defaultValue={g?.oneMove} className="textarea !min-h-[80px]" maxLength={1000} /></Field>
                </div>
                {rt(p.key) && <p className="text-sm text-ink-soft"><span className="font-medium">Road Test. </span>{rt(p.key)}</p>}
                <Submit className="btn-quiet">Save {p.key}</Submit>
              </form>
            </Card>
          );
        })}
      </div>
    </>
  );
}
