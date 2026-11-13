import { requireUser } from "@/lib/auth";
import { ReadTheBook } from "@/components/ReadTheBook";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { BLUEPRINT_AREAS } from "@/content/program";
import { addCommitment, removeCommitment } from "@/app/actions/participant";
import { PageHeader, Card, Source, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";
import Link from "next/link";
import { BLUEPRINT_PICKS } from "@/content/options";
import { LEVELS, PRACTICE, type IdentityLevel } from "@/content/identity";
import { addIdentityPractice } from "@/app/actions/identity";
import { Picks } from "@/components/Picks";
import { OneMoveCards } from "@/components/OneMoveCards";
import { FORGE_LINES, PRACTICE_STARTERS } from "@/content/forgeLines";
import type { PathwayKey } from "@/content/program";
import type { PillarKey } from "@/content/types";

export const metadata = { title: "Discipline by Design blueprint" };

const CADENCES = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", QUARTERLY: "Quarterly", ONCE: "One time" };
const DAY_CHOICES = ["", "Every day", "Weekdays", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function BlueprintPage() {
  const u = await requireUser("PARTICIPANT");
  const { pack } = await getContent();
  const [items, rels] = await Promise.all([
    db.commitment.findMany({ where: { userId: u.id, active: true }, orderBy: { createdAt: "asc" } }),
    db.relationship.findMany({ where: { ownerId: u.id, active: true } }),
  ]);
  const identity = await db.identityProfile.findUnique({ where: { userId: u.id } });
  const profile = await db.profile.findUnique({ where: { userId: u.id } });
  const goals = await db.developmentGoal.findMany({ where: { userId: u.id, status: "ACTIVE", segmentKey: null } });
  const pathway = (profile?.pathway ?? "PERSONAL") as PathwayKey;
  const focus = profile?.priorityPillar as PillarKey | null | undefined;
  const statements = FORGE_LINES.filter((l) => profile?.[l.field]);
  // Practices for the focus pillar come first in the routine picks: this is where the identity turns into habits.
  const picksFor = (area: string) => {
    const base = BLUEPRINT_PICKS[area];
    if (area !== "ROUTINES" || !focus) return base;
    return { status: "draft" as const, options: [...PRACTICE_STARTERS[focus][pathway], ...(base?.options ?? [])] };
  };
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
      <PageHeader eyebrow="Discipline by Design" title="My road" />
      <FromBook label="From the book, Chapter 10">
        {d.intro[0] ? <><p>{d.intro.find((t) => t.startsWith("It's the deliberate construction"))}</p><p className="mt-2">{d.intro.find((t) => t.startsWith("The question isn't"))}</p></> : "The deliberate construction of the routines, relationships, environments, and accountability structures that support sustained development."}
      </FromBook>

      {(statements.length > 0 || profile?.forgeStatement) && (
        <Link href="/plan" className="mb-6 block rounded-2xl bg-navy-deep p-5 text-white hover:bg-navy">
          <p className="text-xs uppercase tracking-[0.14em] text-white/60">This road reinforces</p>
          <p className="mt-2 font-serif text-[18px] leading-snug line-clamp-3">{identity?.becoming || profile?.destination || profile?.forgeStatement}</p>
        </Link>
      )}

      <section id="one-move" className="mb-6 scroll-mt-20">
        <h2 className="h3 mb-3">One move this week</h2>
        {!focus && <p className="mb-3 text-sm muted">Pick a focus pillar from your assessment results first.</p>}
        <OneMoveCards pack={pack} goals={goals} priority={focus} level={identity?.level} />
      </section>

      {d.whosChecking.length > 0 && (
        <Card className="mb-6 border-brass/50">
          <p className="font-serif text-lg leading-snug">{d.whosChecking[0]}</p>
          <FromBook label="So who's checking?" className="mt-2 !mb-0">{d.whosChecking[2]}</FromBook>
        </Card>
      )}

      {identity && (
        <Card className="mb-6" >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="h3">Identity practice</h2>
            <Link href="/identity" className="chip whitespace-nowrap" style={{ borderColor: LEVELS[identity.level as IdentityLevel].color, color: LEVELS[identity.level as IdentityLevel].color }}>Level {LEVELS[identity.level as IdentityLevel].n} · {LEVELS[identity.level as IdentityLevel].name}</Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {PRACTICE[identity.level as IdentityLevel].map((item, i) => {
              const a = item.action;
              const source = a.kind === "commit" ? (a.from === "behavior" ? identity.behavior : a.from === "cue" ? identity.personaCue : a.from === "standards" ? identity.personaStandards : "ok") : "ok";
              const title = a.kind === "commit" ? (a.from === "behavior" ? identity.behavior.split("\n")[0].trim().slice(0, 200) : a.from === "cue" ? identity.personaCue.split("\n")[0].trim().slice(0, 200) : a.from === "standards" ? "Read my standards" : "Review my week against my standards") : "";
              const added = a.kind === "commit" && items.some((c) => c.title === title && c.detail === "Identity shift");
              return (
                <li key={item.text} className="py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                  <span className="text-[15px]">{item.text}</span>
                  {a.kind === "link" ? (
                    <Link href={a.href} className="text-sm btn-link">{a.button}</Link>
                  ) : added ? (
                    <span className="chip !text-sage">In your blueprint</span>
                  ) : source ? (
                    <form action={addIdentityPractice}><input type="hidden" name="index" value={i} /><button className="text-sm btn-link text-left">{a.button}</button></form>
                  ) : (
                    <Link href="/identity" className="text-sm btn-link">{a.from === "behavior" ? "Write your behavior first" : a.from === "cue" ? "Write your activation cue first" : "Write your standards first"}</Link>
                  )}
                </li>
              );
            })}
          </ul>
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
                <ul className="mt-3 divide-y divide-line">
                  {peopleRows.map((row) => {
                    const named = rels.filter((x) => row.roles.includes(x.role));
                    return (
                      <li key={row.label} className="py-3 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[15px] font-medium">{row.label}</p>
                          {named.length > 0
                            ? <p className="text-[15px]">{named.map((x) => x.name).join(", ")}</p>
                            : <p className="text-sm text-ink-mute">Not named yet</p>}
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
                <span className="text-xs muted">{mine.length + people.length || ""}</span>
              </div>
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
                  <p className="mt-2 text-sm text-ink-soft">{text ?? area.hint}</p>
                  <form action={addCommitment} className="mt-3 space-y-3">
                    <input type="hidden" name="area" value={area.key} />
                    <Field label="What"><input name="title" required maxLength={200} className="input" /></Field>
                    {picksFor(area.key) && <Picks list={picksFor(area.key)!} target="title" />}
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
        <FromBook label="From the book: your coach, your feed, your engine" className="mt-6">
          {d.inventory.filter((i) => ["Your coach", "Your feed", "Your engine"].includes(i.label)).map((i) => (
            <p key={i.label} className="mt-2"><span className="font-medium text-ink">{i.label}. </span>{i.text}</p>
          ))}
          <Source>Both Hands on the Wheel, Ch. 10 Discipline by Design, Your Design Inventory</Source>
        </FromBook>
      )}
    </>
  );
}

/** Book passages fold under one small line, so the page shows the client's own road first. */
function FromBook({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <details className={`mb-5 text-sm ${className}`}>
      <summary className="cursor-pointer text-navy">{label}</summary>
      <div className="mt-2 text-ink-soft leading-relaxed">{children}</div>
      {label.startsWith("From the book") && <ReadTheBook kind="passage" className="mt-2" />}
    </details>
  );
}
