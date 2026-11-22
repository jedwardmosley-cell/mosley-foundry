import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAccessCode, setAccessCodeActive } from "@/app/actions/admin";
import { EDITIONS, editionOf, codeProblem } from "@/lib/edition";
import { fmt } from "@/lib/dates";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";

export const metadata = { title: "Access codes" };

const MADE: Record<string, string> = {
  "1": "Code made. Hand it out.",
  short: "A code needs at least four letters or numbers.",
  taken: "That code already exists. Pick another.",
};
const STATE: Record<string, string> = { off: "Off", expired: "Ended", full: "Used up" };

export default async function AccessCodes({ searchParams }: { searchParams: Promise<{ made?: string }> }) {
  await requireUser("ADMIN");
  const sp = await searchParams;
  const codes = await db.accessCode.findMany({ orderBy: { createdAt: "desc" } });
  const counts = await db.user.groupBy({ by: ["edition"], _count: true });
  const renewal = counts.find((c) => c.edition === "RENEWAL")?._count ?? 0;
  return (
    <>
      <PageHeader eyebrow="Editions" title="Access codes" plain={`${renewal} ${renewal === 1 ? "person is" : "people are"} in The Road to Renewal`}>
        A code opens an edition of the app. Someone signs up as usual, taps The Road to Renewal and types the code. Make one code per church, group or cohort, so you can turn one off without touching the others.
      </PageHeader>
      {sp.made && MADE[sp.made] && <p role="status" className="notice mb-4">{MADE[sp.made]}</p>}

      <Card>
        <h2 className="h3">Make a code</h2>
        <form action={createAccessCode} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Code" hint="What people type. Letters and numbers; dashes are fine."><input name="shown" required minLength={4} maxLength={40} placeholder="RENEW-GRACE" className="input uppercase" autoCapitalize="characters" /></Field>
          <Field label="Opens"><select name="edition" className="input">{Object.values(EDITIONS).filter((e) => e.key !== "BOTH_HANDS").map((e) => <option key={e.key} value={e.key}>{e.name}</option>)}</select></Field>
          <Field label="Who it's for" hint="Only you see this."><input name="label" maxLength={200} placeholder="Grace Church, spring group" className="input" /></Field>
          <Field label="How many people can use it" hint="Leave blank for no limit."><input name="maxUses" inputMode="numeric" pattern="\d*" className="input" /></Field>
          <Field label="Last day it works" hint="Leave blank to keep it open."><input type="date" name="expiresOn" className="input" /></Field>
          <div className="sm:col-span-2"><Submit className="btn-primary">Make the code</Submit></div>
        </form>
      </Card>

      <section className="mt-6 border-t border-line/70" aria-label="Codes">
        {codes.length === 0 && <p className="py-5 text-[15px] text-ink-mute">No codes yet.</p>}
        <ul className="divide-y divide-line/60">
          {codes.map((c) => {
            const problem = codeProblem(c);
            return (
              <li key={c.id} className="py-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-book text-[21px] tracking-wide text-heading">{c.shown || c.code}</p>
                  <p className="text-sm text-ink-soft">{editionOf(c.edition).name}{c.label ? `. ${c.label}` : ""}</p>
                  <p className="mt-0.5 text-sm text-ink-mute">
                    Used {c.uses}{c.maxUses != null ? ` of ${c.maxUses}` : ""}{c.expiresAt ? `. Works through ${fmt(c.expiresAt, { month: "short", day: "numeric", year: "numeric" })}` : ""}{problem && problem !== "unknown" ? `. ${STATE[problem]}` : ""}
                  </p>
                </div>
                <form action={setAccessCodeActive}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={c.active ? "off" : "on"} />
                  <Submit className={c.active ? "btn-quiet !text-alert" : "btn-quiet"}>{c.active ? "Turn off" : "Turn back on"}</Submit>
                </form>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-sm text-ink-mute">Turning a code off stops new people from using it. Anyone who already used it stays in their edition.</p>
      </section>
    </>
  );
}
