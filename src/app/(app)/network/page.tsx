import Link from "next/link";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { RELATIONSHIP_ROLES } from "@/content/program";
import { addRelationship, logRelationshipCheckIn, removeRelationship, createInvite } from "@/app/actions/participant";
import { fmt, daysBetween, ymd } from "@/lib/dates";
import { PageHeader, Card, Field, Source } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { RelationshipFields } from "@/components/RelationshipFields";

export const metadata = { title: "People" };

export default async function NetworkPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role: wantedRole } = await searchParams;
  const u = await requireUser("PARTICIPANT");
  const { pack } = await getContent();
  const rels = await db.relationship.findMany({
    where: { ownerId: u.id, active: true },
    orderBy: { nextCheckIn: "asc" },
    include: { checkIns: { orderBy: { occurredOn: "desc" }, take: 5 }, linkedUser: { select: { name: true } } },
  });
  const host = (await headers()).get("host");
  const today = new Date();
  const withState = rels.map((r) => ({ ...r, overdue: !!r.nextCheckIn && daysBetween(today, r.nextCheckIn) < 0 }));
  const has = (roles: string[]) => rels.some((r) => roles.includes(r.role));
  const health = [
    { ok: has(["MENTOR"]), label: "A mentor: someone further up the road" },
    { ok: has(["ACCOUNTABILITY_PARTNER", "COACH"]), label: "Someone who checks on you" },
    { ok: has(["MENTEE", "DIRECT_REPORT"]), label: "Someone you are developing" },
    { ok: has(["GROUP"]), label: "A group pointed toward growth" },
    { ok: withState.every((r) => !r.overdue), label: "Every check-in current" },
  ];

  return (
    <>
      <PageHeader eyebrow="My Design" title="My people">
        {rels.length === 0 ? (pack.nobodyNote ?? "A life built around growth needs people built around growth.") : "The people around your growth, and how often you check in with each one."}
      </PageHeader>

      <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
        <Link href="/road" className="card flex flex-col justify-center hover:border-navy/40">
          <p className="eyebrow">My Design</p>
          <p className="mt-1 text-[15px]">Your people are one part of your design, with your routines, groups and programs. See the whole map.</p>
          <span className="mt-2 text-sm btn-link">Open My Design</span>
        </Link>
        <Card>
          <p className="eyebrow">Your people</p>
          <ul className="mt-3 space-y-2.5">
            {health.map((h) => (
              <li key={h.label} className="flex items-start gap-2.5 text-[15px]">
                <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-full text-[11px] flex items-center justify-center ${h.ok ? "bg-navy text-white" : "border border-alert text-alert"}`}>{h.ok ? "✓" : "!"}</span>
                <span className={h.ok ? "" : "text-ink"}>{h.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <h2 className="h2 mt-8 mb-3">People</h2>
      {rels.length > 0 && <p className="-mt-1 mb-3 text-sm text-ink-soft">Tap a person to add a check-in or see past ones.</p>}
      <div className="space-y-3">
        {withState.map((r) => (
          // Each person is one line until opened, so a long list stays short on a phone.
          <details key={r.id} className="card group !py-4" data-person={r.name}>
            <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <h3 className="h3">{r.name} <span className="muted font-normal">· {RELATIONSHIP_ROLES[r.role as keyof typeof RELATIONSHIP_ROLES]}</span></h3>
              <span className={`text-sm ${r.overdue ? "text-alert" : "muted"}`}>{r.overdue ? "was due" : "next"} {fmt(r.nextCheckIn)} <span aria-hidden className="ml-1 inline-block transition group-open:rotate-90">›</span></span>
            </summary>
            <p className="mt-1 text-sm muted">Every {r.cadenceDays} days</p>
            {r.purpose && <p className="mt-1 text-[15px] text-ink-soft">{r.purpose}</p>}
            {r.checkIns.length > 0 && (
              <ul className="mt-3 space-y-2 text-sm">
                {r.checkIns.map((c) => (
                  <li key={c.id} className="rounded-lg bg-paper p-2.5">
                    <span className="font-medium">{fmt(c.occurredOn)}</span> · {c.happened ? "Met" : "Did not happen"}
                    {c.lessons && <span className="block text-ink-soft">Lesson: {c.lessons}</span>}
                    {c.agreedActions && <span className="block text-ink-soft">Agreed: {c.agreedActions}</span>}
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-link">Add a people check-in</summary>
              <form action={logRelationshipCheckIn} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={r.id} />
                <Field label="Date"><input type="date" name="occurredOn" defaultValue={ymd()} className="input" /></Field>
                <label className="flex items-center gap-2 text-sm sm:mt-7"><input type="checkbox" name="happened" defaultChecked className="h-4 w-4 accent-navy" /> It happened</label>
                <details className="sm:col-span-2">
                  <summary className="cursor-pointer text-sm text-link">Lesson and agreed actions <span className="text-ink-mute">(optional)</span></summary>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <Field label="Lesson"><input name="lessons" className="input" maxLength={4000} /></Field>
                    <Field label="Agreed actions"><input name="agreedActions" className="input" maxLength={4000} /></Field>
                  </div>
                </details>
                <div className="sm:col-span-2"><Submit className="btn-quiet">Save people check-in</Submit></div>
              </form>
            </details>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              {r.inviteStatus === "ACCEPTED" ? (
                <span className="chip !text-link">Connected{r.linkedUser ? ` as ${r.linkedUser.name}` : ""}</span>
              ) : r.inviteStatus === "PENDING" && r.inviteToken ? (
                <span className="text-ink-soft break-all">Invite link: <code className="text-xs">{`${host?.includes("localhost") ? "http" : "https"}://${host}/invite/${r.inviteToken}`}</code></span>
              ) : (
                <form action={createInvite}><input type="hidden" name="id" value={r.id} /><button className="btn-link">Create invitation link</button></form>
              )}
              <form action={removeRelationship}><input type="hidden" name="id" value={r.id} /><button className="text-ink-mute hover:text-alert">Remove</button></form>
            </div>
          </details>
        ))}
      </div>

      <div id="add" className="scroll-mt-20" />
      <details className="card mt-6" open={rels.length === 0 || !!wantedRole}>
        <summary className="cursor-pointer h3 text-link">Add a person or group</summary>
        <form action={addRelationship} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input name="name" required maxLength={120} className="input" /></Field>
          <RelationshipFields initialRole={wantedRole && wantedRole in RELATIONSHIP_ROLES ? wantedRole : undefined} />
          <details className="sm:col-span-2">
            <summary className="cursor-pointer text-sm text-link">Next check-in date <span className="text-ink-mute">(optional, defaults from the schedule)</span></summary>
            <div className="mt-2 max-w-xs"><Field label="Next check-in"><input type="date" name="nextCheckIn" className="input" /></Field></div>
          </details>
          <details className="sm:col-span-2"><summary className="cursor-pointer text-sm text-link">Email <span className="text-ink-mute">(optional, only for invitation links)</span></summary><div className="mt-2"><input type="email" name="email" aria-label="Email" className="input" /></div></details>
          <div className="sm:col-span-2"><Submit>Add</Submit></div>
        </form>
        <p className="mt-4 text-xs text-ink-mute">Invited people can see that you named them. They never see your assessments, reflections, journal or plan.</p>
        {pack.namePeople.length > 0 && <Source>Both Hands on the Wheel</Source>}
      </details>
    </>
  );
}
