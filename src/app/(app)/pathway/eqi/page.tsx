import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { addEqi, updateEqi, approveEqiInterpretation, deleteEqi, setEqiEnabled, addEqiToBlueprint, shareEqi } from "@/app/actions/participant";
import type { PillarKey } from "@/content/types";
import { PageHeader, Card, Field, PillarMark } from "@/components/ui";
import { Submit } from "@/components/Submit";

export const metadata = { title: "EQ-i priorities" };

export default async function EqiPage() {
  const u = await requireUser("PARTICIPANT");
  const { pack } = await getContent();
  const [profile, items, coaches, grant] = await Promise.all([
    db.profile.findUnique({ where: { userId: u.id } }),
    db.eqiPriority.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } }),
    db.coachAssignment.findMany({ where: { participantId: u.id, active: true }, include: { coach: { select: { name: true } } } }),
    db.shareGrant.findFirst({ where: { ownerId: u.id, scope: "EQI" } }),
  ]);
  const on = !!profile?.eqiEnabled;
  const pillarName = (k: string | null) => pack.pillars.find((p) => p.key === k)?.name;
  const PillarSelect = ({ value }: { value?: string | null }) => (
    <select name="pillar" defaultValue={value ?? ""} className="input">
      <option value="">Choose a pillar</option>
      {pack.pillars.map((p) => <option key={p.key} value={p.key}>{p.name}: {p.short}</option>)}
    </select>
  );

  if (!on) {
    return (
      <>
        <PageHeader eyebrow="Optional" title="EQ-i priorities">
          This part is for people who have taken the EQ-i 2.0 and had a debrief with a certified facilitator. If that is you, turn it on to connect what you learned to your FORGE work. If you have not taken the EQ-i, you can skip this. The rest of the app works the same without it.
        </PageHeader>
        <Card>
          <form action={setEqiEnabled} className="flex flex-wrap items-center gap-4">
            <input type="hidden" name="on" value="true" />
            <Submit>I have had my EQ-i debrief</Submit>
            <Link href="/pathway" className="btn-link text-sm">Skip for now</Link>
          </form>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Optional · EQ-i 2.0" title="EQ-i priorities">
        Write down the one or two priorities you took from your debrief, in your own words. Then connect each one to a FORGE pillar and a practice, so it becomes part of your daily work. Please do not upload or copy your report. Everything here is private until you share it.
      </PageHeader>

      <div className="space-y-4">
        {items.map((e) => {
          const shared = e.participantApproved && !!grant;
          return (
            <Card key={e.id}>
              <div className="flex justify-between gap-3">
                <h2 className="h3 flex items-center gap-2">{e.pillar && <PillarMark k={e.pillar as PillarKey} size="sm" />}{e.label}</h2>
                <form action={deleteEqi}><input type="hidden" name="id" value={e.id} /><button className="text-sm text-ink-mute hover:text-clay">Remove</button></form>
              </div>
              {e.note && <p className="mt-2 text-[15px]">{e.note}</p>}

              <form action={updateEqi} className="mt-4 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={e.id} />
                <Field label="FORGE pillar this connects to" hint="Your call. Pick the pillar where this priority shows up most."><PillarSelect value={e.pillar} /></Field>
                <Field label="Practice I will try"><input name="practice" defaultValue={e.practice} maxLength={1500} className="input" /></Field>
                <div className="sm:col-span-2"><Submit className="btn-quiet">Save</Submit></div>
              </form>

              <div className="mt-4 border-t border-line pt-4">
                <p className="eyebrow mb-2">Put it to work</p>
                <div className="flex flex-wrap gap-2">
                  {e.pillar ? (
                    <Link href={`/cycle/new?pillar=${e.pillar}&focus=${encodeURIComponent(e.practice || e.label)}`} className="btn-quiet">Start a 30-day cycle on {pillarName(e.pillar)}</Link>
                  ) : (
                    <span className="text-sm text-ink-mute self-center">Choose a pillar to start a 30-day cycle.</span>
                  )}
                  {e.practice ? (
                    <form action={addEqiToBlueprint}><input type="hidden" name="id" value={e.id} /><button className="btn-quiet">Add the practice to my Blueprint</button></form>
                  ) : (
                    <span className="text-sm text-ink-mute self-center">Add a practice to put it in your Blueprint.</span>
                  )}
                  {coaches.length > 0 && !shared && (
                    <form action={shareEqi}><input type="hidden" name="id" value={e.id} /><button className="btn-quiet">Share with {coaches[0].coach.name.split(" (")[0]}</button></form>
                  )}
                </div>
                {shared && (
                  <form action={approveEqiInterpretation} className="mt-3 text-sm">
                    <input type="hidden" name="id" value={e.id} /><input type="hidden" name="approved" value="false" />
                    <span className="chip !text-sage mr-2">Shared with coach</span>
                    <button className="btn-link">Stop sharing this one</button>
                  </form>
                )}
              </div>

              {e.coachInterpretation && (
                <div className="mt-4 rounded-xl bg-paper p-3">
                  <p className="text-xs text-ink-mute">Your coach wrote this after your debrief</p>
                  <p className="mt-1 text-[15px]">{e.coachInterpretation}</p>
                  {!e.participantApproved && (
                    <form action={approveEqiInterpretation} className="mt-2">
                      <input type="hidden" name="id" value={e.id} /><input type="hidden" name="approved" value="true" />
                      <button className="btn-link text-sm">This looks right. Share it with my coach again</button>
                    </form>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <h2 className="h3">Add a priority</h2>
        <form action={addEqi} className="mt-3 space-y-3">
          <Field label="Priority from my debrief" hint="Your own words. For example: Impulse control in budget meetings"><input name="label" required maxLength={200} className="input" /></Field>
          <Field label="FORGE pillar this connects to"><PillarSelect /></Field>
          <details>
            <summary className="cursor-pointer text-sm text-navy">Add what I noticed and a practice <span className="text-ink-mute">(optional)</span></summary>
            <div className="mt-3 space-y-3">
              <Field label="What I noticed"><textarea name="note" maxLength={1500} className="textarea" /></Field>
              <Field label="Practice I will try"><input name="practice" maxLength={1500} className="input" /></Field>
            </div>
          </details>
          <Submit>Add priority</Submit>
        </form>
      </Card>

      <form action={setEqiEnabled} className="mt-6">
        <input type="hidden" name="on" value="false" />
        <button className="text-sm text-ink-mute hover:text-ink">Turn off the EQ-i section. Your entries are kept.</button>
      </form>
      <p className="mt-4 text-xs text-ink-mute max-w-2xl">EQ-i 2.0 is an assessment published by MHS. This app does not store EQ-i reports or scores, and the AI Companion does not interpret EQ-i results. FORGE self-ratings and EQ-i scores measure different things, so one cannot stand in for the other. Your coach sees a priority only after you share it.</p>
    </>
  );
}
