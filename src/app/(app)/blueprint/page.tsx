import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { BLUEPRINT_AREAS } from "@/content/program";
import { addCommitment, removeCommitment } from "@/app/actions/participant";
import { PageHeader, Card, Source, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";
import Link from "next/link";
import { BLUEPRINT_PICKS } from "@/content/options";
import { Picks } from "@/components/Picks";

export const metadata = { title: "Discipline by Design Blueprint" };

const CADENCES = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", QUARTERLY: "Quarterly", ONCE: "One time" };
const DAY_CHOICES = ["", "Every day", "Weekdays", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function BlueprintPage() {
  const u = await requireUser("PARTICIPANT");
  const { pack } = await getContent();
  const [items, rels] = await Promise.all([
    db.commitment.findMany({ where: { userId: u.id, active: true }, orderBy: { createdAt: "asc" } }),
    db.relationship.findMany({ where: { ownerId: u.id, active: true } }),
  ]);
  const d = pack.discipline;
  const inv = (label: string | null) => (label ? d.inventory.find((i) => i.label === label)?.text : undefined);
  // The four people areas (accountability partners, mentors and coaches, mentees, groups) show as one card.
  const PEOPLE_AREAS = ["ACCOUNTABILITY", "MENTORING", "MENTEES", "GROUPS"];
  const first = (label: string) => (inv(label) ?? "").split(/(?<=[.?!])\s/)[0];
  const peopleRows = [
    { label: "Accountability partner", roles: ["ACCOUNTABILITY_PARTNER"], add: "ACCOUNTABILITY_PARTNER", line: "When you don't do what you said, who finds out?" },
    { label: "Mentor", roles: ["MENTOR"], add: "MENTOR", line: first("Your mentor") },
    { label: "Coach", roles: ["COACH"], add: "COACH", line: "Somebody who works with you on the road you're on right now." },
    { label: "Mentee", roles: ["MENTEE", "DIRECT_REPORT"], add: "MENTEE", line: first("Your mentee") },
    { label: "Group", roles: ["GROUP"], add: "GROUP", line: first("Your groups") },
  ];
  const peopleNamed = peopleRows.filter((r) => rels.some((x) => r.roles.includes(x.role))).length;

  return (
    <>
      <PageHeader eyebrow="Chapter 10" title="Discipline by Design Blueprint">
        {d.intro[0] ? <><p>{d.intro.find((t) => t.startsWith("It's the deliberate construction"))}</p><p className="mt-2">{d.intro.find((t) => t.startsWith("The question isn't"))}</p></> : "The deliberate construction of the routines, relationships, environments, and accountability structures that support sustained development."}
      </PageHeader>

      {d.whosChecking.length > 0 && (
        <Card className="mb-6 bg-navy-deep border-navy-deep text-white">
          <p className="eyebrow !text-white/60">So who&apos;s checking?</p>
          <p className="mt-2 font-serif text-xl leading-snug">{d.whosChecking[0]}</p>
          <p className="mt-3 text-white/80 text-[15px]">{d.whosChecking[2]}</p>
        </Card>
      )}

      <div className="space-y-4">
        {BLUEPRINT_AREAS.map((area) => {
          if (area.key === "ACCOUNTABILITY") {
            return (
              <Card key="PEOPLE">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="h3">My people</h2>
                  <span className="text-xs muted">{peopleNamed} of {peopleRows.length} named</span>
                </div>
                <p className="mt-1 text-sm text-ink-soft">A life built around growth needs people built around growth. Name one person for each role.</p>
                <ul className="mt-3 divide-y divide-line">
                  {peopleRows.map((row) => {
                    const named = rels.filter((x) => row.roles.includes(x.role));
                    return (
                      <li key={row.label} className="py-3 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[15px] font-medium">{row.label}</p>
                          {named.length > 0
                            ? <p className="text-[15px]">{named.map((x) => x.name).join(", ")}</p>
                            : row.line && <p className="text-sm text-ink-soft">{row.line}</p>}
                        </div>
                        {named.length > 0
                          ? <Link href="/network" className="text-sm btn-link shrink-0">Check-ins</Link>
                          : <Link href={`/network?role=${row.add}#add`} className="text-sm btn-link shrink-0">Add</Link>}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          }
          if (PEOPLE_AREAS.includes(area.key)) return null;
          const mine = items.filter((i) => i.area === area.key);
          const people: typeof rels = [];
          const text = inv(area.inventory);
          return (
            <Card key={area.key}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="h3">{area.label}</h2>
                <span className="text-xs muted">{mine.length + people.length || "Not designed yet"}</span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{text ?? area.hint}</p>
              {(mine.length > 0 || people.length > 0) && (
                <ul className="mt-3 divide-y divide-line">
                  {people.map((r) => (
                    <li key={r.id} className="py-2 flex justify-between text-[15px]"><span>{r.name}</span><Link href="/network" className="text-sm btn-link">every {r.cadenceDays} days</Link></li>
                  ))}
                  {mine.map((c) => (
                    <li key={c.id} className="py-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[15px]">{c.title}</p>
                        <p className="text-sm muted">{CADENCES[c.cadence as keyof typeof CADENCES]}{c.when ? ` · ${c.when}` : ""}{c.detail ? ` · ${c.detail}` : ""}</p>
                      </div>
                      <form action={removeCommitment}><input type="hidden" name="id" value={c.id} /><button className="text-sm text-ink-mute hover:text-clay" aria-label={`Remove ${c.title}`}>Remove</button></form>
                    </li>
                  ))}
                </ul>
              )}
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-navy">Add to this area</summary>
                  <form action={addCommitment} className="mt-3 space-y-3">
                    <input type="hidden" name="area" value={area.key} />
                    <Field label="What"><input name="title" required maxLength={200} className="input" /></Field>
                    {BLUEPRINT_PICKS[area.key] && <Picks list={BLUEPRINT_PICKS[area.key]} target="title" />}
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                      <Field label="How often">
                        <select name="cadence" className="input" defaultValue={area.key === "ROUTINES" ? "DAILY" : area.key === "REVIEW" ? "QUARTERLY" : area.key === "LEARNING" ? "MONTHLY" : "WEEKLY"}>
                          {Object.entries(CADENCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </Field>
                      <Field label="Which days">
                        <select name="whenDays" className="input" defaultValue={area.key === "ROUTINES" ? "Every day" : area.key === "WEEKLY" ? "Sunday" : ""}>
                          {DAY_CHOICES.map((d) => <option key={d} value={d}>{d || "Any day"}</option>)}
                        </select>
                      </Field>
                      <Field label="Time (optional)"><input type="time" name="whenTime" className="input" /></Field>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-sm text-navy">More details <span className="text-ink-mute">(optional)</span></summary>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="Starting"><input type="date" name="startsOn" className="input" /></Field>
                        <Field label="Detail"><input name="detail" maxLength={1500} className="input" /></Field>
                      </div>
                    </details>
                    <Submit className="btn-quiet">Add</Submit>
                  </form>
                </details>
            </Card>
          );
        })}
      </div>
      {d.inventory.length > 0 && (
        <Card className="mt-6">
          <p className="eyebrow">Also in the Design Inventory</p>
          {d.inventory.filter((i) => ["Your coach", "Your feed", "Your engine"].includes(i.label)).map((i) => (
            <p key={i.label} className="mt-3 text-[15px] leading-relaxed"><span className="font-medium">{i.label}. </span>{i.text}</p>
          ))}
          <Source>Both Hands on the Wheel, Ch. 10 Discipline by Design, Your Design Inventory</Source>
        </Card>
      )}
    </>
  );
}
