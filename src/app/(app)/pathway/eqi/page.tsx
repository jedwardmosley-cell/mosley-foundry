import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { addEqi, approveEqiInterpretation, deleteEqi } from "@/app/actions/participant";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";

export const metadata = { title: "EQ-i development priorities" };

export default async function EqiPage() {
  const u = await requireUser("PARTICIPANT");
  const items = await db.eqiPriority.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } });
  return (
    <>
      <PageHeader eyebrow="Segment 02 · Knowing Yourself as a Leader" title="EQ-i development priorities">
        For participants who completed an authorized EQ-i 2.0 assessment with a qualified practitioner. Enter the priorities you took from your debrief, in your own words. Do not upload or copy your report. Everything here is private unless you share it.
      </PageHeader>
      <div className="space-y-4">
        {items.map((e) => (
          <Card key={e.id}>
            <div className="flex justify-between gap-3">
              <h2 className="h3">{e.label}</h2>
              <form action={deleteEqi}><input type="hidden" name="id" value={e.id} /><button className="text-sm text-ink-mute hover:text-clay">Remove</button></form>
            </div>
            {e.note && <p className="mt-2 text-[15px]">{e.note}</p>}
            {e.practice && <p className="mt-2 text-[15px]"><span className="text-ink-mute">Practice: </span>{e.practice}</p>}
            {e.coachInterpretation && (
              <div className="mt-3 rounded-xl bg-paper p-3">
                <p className="text-xs text-ink-mute">Your coach&apos;s recorded interpretation</p>
                <p className="mt-1 text-[15px]">{e.coachInterpretation}</p>
              </div>
            )}
            <form action={approveEqiInterpretation} className="mt-3">
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="approved" value={e.participantApproved ? "false" : "true"} />
              <button className="btn-link text-sm">{e.participantApproved ? "Approved for my coach. Withdraw approval" : "Approve this item for my coach to see"}</button>
            </form>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <form action={addEqi} className="space-y-3">
          <Field label="Development priority" hint="Your words, e.g. 'Impulse control in budget meetings'"><input name="label" required maxLength={200} className="input" /></Field>
          <Field label="What I noticed (optional)"><textarea name="note" maxLength={1500} className="textarea" /></Field>
          <Field label="Practice I will try (optional)"><input name="practice" maxLength={1500} className="input" /></Field>
          <Submit>Add priority</Submit>
        </form>
      </Card>
      <p className="mt-6 text-xs text-ink-mute max-w-2xl">EQ-i 2.0 is a registered assessment published by MHS. This app does not store EQ-i reports, reproduce EQ-i content, or interpret results with AI. FORGE self-ratings are not equivalent to EQ-i scores. Coach visibility requires both the EQ-i sharing switch and your approval of each item.</p>
    </>
  );
}
