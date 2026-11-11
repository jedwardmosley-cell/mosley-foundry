import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { addJournal, deleteJournal } from "@/app/actions/participant";
import { fmt } from "@/lib/dates";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";

export const metadata = { title: "Private Journal" };

export default async function JournalPage() {
  const u = await requireUser("PARTICIPANT");
  const entries = await db.journalEntry.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader eyebrow="Private to you" title="Private Journal">
        Nothing here can be shared. Coaches, administrators and the AI Companion have no access to it.
      </PageHeader>
      <Card>
        <form action={addJournal} className="space-y-3">
          <Field label="Title (optional)"><input name="title" maxLength={200} className="input" /></Field>
          <Field label="Entry"><textarea name="body" required maxLength={20000} className="textarea min-h-[160px]" /></Field>
          <Submit>Save entry</Submit>
        </form>
      </Card>
      <div className="mt-6 space-y-3">
        {entries.map((e) => (
          <Card key={e.id}>
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-xs text-ink-mute">{fmt(e.createdAt, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
                {e.title && <h2 className="h3 mt-1">{e.title}</h2>}
              </div>
              <form action={deleteJournal}><input type="hidden" name="id" value={e.id} /><button className="text-sm text-ink-mute hover:text-clay">Delete</button></form>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{e.body}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
