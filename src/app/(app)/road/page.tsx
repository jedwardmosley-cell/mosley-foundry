import { DAY_CHOICES as DAY_LABELS, isScheduled, scheduleOf, daysToText } from "@/lib/schedule";
import { requireUser } from "@/lib/auth";
import { activeFocuses } from "@/lib/focusData";
import { focusTitle } from "@/lib/focus";
import { ReadTheBook } from "@/components/ReadTheBook";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { BLUEPRINT_AREAS } from "@/content/program";
import { addCommitment, removeCommitment, updateCommitmentSchedule } from "@/app/actions/participant";
import { PageHeader, Card, Source, Field, PillarMark } from "@/components/ui";
import { Submit } from "@/components/Submit";
import Link from "next/link";
import { BLUEPRINT_PICKS } from "@/content/options";
import { withArticle } from "@/content/whoIAm";
import { Picks } from "@/components/Picks";
import { Icon, IconBadge, type IconName } from "@/components/Icon";
import { SystemMap, type MapNode, type MapKind } from "@/components/SystemMap";
import { FORGE_LINES, PRACTICE_STARTERS } from "@/content/forgeLines";
import type { PathwayKey } from "@/content/program";
import type { PillarKey } from "@/content/types";

export const metadata = { title: "My Design" };

const CADENCES = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", QUARTERLY: "Quarterly", ONCE: "One time" };
const AREA_ICON: Record<string, IconName> = { ROUTINES: "sun", WEEKLY: "calendar", RELATIONSHIPS: "people", LEARNING: "book", LEADERSHIP: "flag", REVIEW: "repeat" };
const DAY_CHOICES = DAY_LABELS.map((d) => d.label);

export default async function MyRoadPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { add } = await searchParams;
  const u = await requireUser("PARTICIPANT");
  const { pack } = await getContent();
  const [items, rels] = await Promise.all([
    db.commitment.findMany({ where: { userId: u.id, active: true }, orderBy: { createdAt: "asc" } }),
    db.relationship.findMany({ where: { ownerId: u.id, active: true } }),
  ]);
  const identity = await db.identityProfile.findUnique({ where: { userId: u.id } });
  const profile = await db.profile.findUnique({ where: { userId: u.id } });
  const focuses = await activeFocuses(u.id);
  const pathway = (profile?.pathway ?? "PERSONAL") as PathwayKey;
  const focus = profile?.priorityPillar as PillarKey | null | undefined;
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
  // The map: everything the client has built, around them. Only what is really there shows.
  const today = new Date();
  const ROLE_KIND: Record<string, MapKind> = { ACCOUNTABILITY_PARTNER: "partner", MENTOR: "guide", COACH: "guide", GROUP: "group", MENTEE: "develop", DIRECT_REPORT: "develop" };
  const AREA_KIND: Record<string, MapKind> = { LEARNING: "learning", GROUPS: "group", MENTEES: "develop", MENTORING: "guide", ACCOUNTABILITY: "partner" };
  const mapNodes: MapNode[] = [
    ...items.map((c) => ({ id: c.id, label: c.title, kind: AREA_KIND[c.area] ?? ("routine" as MapKind), href: `#area-${c.area}` })),
    ...rels.map((r) => ({ id: r.id, label: r.name, kind: ROLE_KIND[r.role] ?? ("partner" as MapKind), href: "/network", overdue: !!r.nextCheckIn && r.nextCheckIn < today })),
  ];

  return (
    <>
      <PageHeader eyebrow="Discipline by Design" title="My Design">The system that makes it hard to fail: your routines, your people, your groups and programs, the people you develop. It stays, and it grows.</PageHeader>
      <div className="mb-8"><SystemMap name={u.name} nodes={mapNodes} /></div>
      <FromBook label="From the book">
        {d.intro[0] ? <><p>{d.intro.find((t) => t.startsWith("It's the deliberate construction"))}</p><p className="mt-2">{d.intro.find((t) => t.startsWith("The question isn't"))}</p></> : "The deliberate construction of the routines, relationships, environments, and accountability structures that support sustained development."}
      </FromBook>

      {/* The design is built around the whole identity, all five rules, not only the current focus. */}
      <section className="mb-10 overflow-hidden rounded-2xl border border-line">
        {(identity?.becoming || profile?.forgeStatement) ? (
          <Link href="/identity" className="block bg-ink px-5 py-6 sm:px-7 text-paper transition hover:bg-ink/90">
            <p className="flex items-center justify-between text-[13px] font-bold text-paper/70">Built around who I am{identity?.role ? `, as ${withArticle(identity.role)}` : ""}<Icon name="arrow" className="h-4 w-4 text-paper/50" /></p>
            <p className="mt-3 font-serif text-[20px] sm:text-[22px] leading-[1.3] tracking-[-0.01em] line-clamp-6"><span aria-hidden className="mr-1 text-lane">&ldquo;</span>{profile?.forgeStatement || identity?.becoming}</p>
          </Link>
        ) : (
          <Link href="/identity" className="block bg-ink px-5 py-6 sm:px-7 text-paper">
            <p className="text-[13px] font-bold text-paper/70">Built around who I am</p>
            <p className="mt-2 text-[15px] text-paper/80">Claim who you are first. Your design is built around it.</p>
          </Link>
        )}
        <div className="bg-card px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-center gap-1.5" aria-hidden>{FORGE_LINES.map((l) => <PillarMark key={l.pillar} k={l.pillar} size="sm" />)}</div>
          <p className="mt-3 text-[15px] text-ink">Your routines, your people and your accountability support the whole of who you are, all five rules, every day. Not just one goal.</p>
          {focuses.length > 0 && (
            <p className="mt-3 text-sm text-ink-soft">
              Your focus right now is one part of it:{" "}
              {focuses.map((f, i) => <span key={f.id}>{i > 0 && ", "}<Link href={`/cycle?id=${f.id}`} className="btn-link">{focusTitle(f)}</Link></span>)}
            </p>
          )}
        </div>
      </section>

      {d.whosChecking.length > 0 && (
        <figure className="mb-10 border-l-4 border-lane pl-5">
          <blockquote className="font-serif text-[21px] sm:text-[24px] leading-[1.3] tracking-[-0.01em] text-heading">{d.whosChecking[0]}</blockquote>
          <FromBook label="So who's checking?" className="mt-3 !mb-0">{d.whosChecking[2]}</FromBook>
        </figure>
      )}

      <SectionHead title="Routines and reviews" sub="What you do on a schedule, so you don't have to decide each time." />
      <p className="-mt-2 mb-4 text-sm text-ink-soft">Want these on your phone? <Link href="/settings" className="btn-link">Put them on your calendar</Link>.</p>
      <div className="card !p-0 divide-y divide-line/60">
        {BLUEPRINT_AREAS.map((area) => {
          if (area.key === "ACCOUNTABILITY" || PEOPLE_AREAS.includes(area.key)) return null;
          const mine = items.filter((i) => i.area === area.key);
          const people: typeof rels = [];
          const text = inv(area.inventory);
          return (
            <section key={area.key} id={`area-${area.key}`} className="scroll-mt-24 px-5 py-5 sm:px-7">
              <div className="flex items-center gap-3">
                <IconBadge name={AREA_ICON[area.key] ?? "target"} />
                <h3 className="h3 flex-1 leading-snug">{area.label}</h3>
                {mine.length + people.length > 0 && <span className="chip">{mine.length + people.length}</span>}
              </div>
              {(mine.length > 0 || people.length > 0) && (
                <ul className="mt-3 divide-y divide-line/60">
                  {people.map((r) => (
                    <li key={r.id} className="py-2 flex justify-between text-[15px]"><span>{r.name}</span><Link href="/network" className="text-sm btn-link">every {r.cadenceDays} days</Link></li>
                  ))}
                  {mine.map((c) => (
                    <li key={c.id} className="py-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[15px]">{c.title}</p>
                        <p className="text-sm muted">{CADENCES[c.cadence as keyof typeof CADENCES]}{c.when ? `, ${c.when}` : ""}{c.detail ? `. ${c.detail}` : ""}</p>
                        <ScheduleEdit c={c} />
                      </div>
                      <form action={removeCommitment}><input type="hidden" name="id" value={c.id} /><button className="text-[13px] text-ink-mute hover:text-alert" aria-label={`Remove ${c.title}`}>Remove</button></form>
                    </li>

                  ))}
                </ul>
              )}
                <details className="mt-3" open={add === area.key}>
                  <summary className="cursor-pointer text-sm text-link">Add to this area</summary>
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
                      <summary className="cursor-pointer text-sm text-link">More details <span className="text-ink-mute">(optional)</span></summary>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="Starting"><input type="date" name="startsOn" className="input" /></Field>
                        <Field label="Detail"><input name="detail" maxLength={1500} className="input" /></Field>
                      </div>
                    </details>
                    <Submit className="btn-quiet">Add</Submit>
                  </form>
                </details>
            </section>
          );
        })}
      </div>
      <section className="mt-10">
        <SectionHead title="My people" meta={<span className="chip">{peopleNamed} of {peopleRows.length} named</span>} />
        <Card>
                <ul className="-my-2 divide-y divide-line/60">
                  {peopleRows.map((row) => {
                    const named = rels.filter((x) => row.roles.includes(x.role));
                    return (
                      <li key={row.label} className="py-3 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[13px] text-ink-mute">{row.label}</p>
                          {named.length > 0
                            ? <p className="text-[15px]">{named.map((x) => x.name).join(", ")}</p>
                            : <p className="text-[15px] text-ink-mute/80">Not named yet</p>}
                        </div>
                        {named.length > 0
                          ? <Link href="/network" className="text-sm btn-link shrink-0">Check-ins</Link>
                          : <Link href={`/network?role=${row.add}#add`} className="btn-quiet !px-3.5 !py-1.5 text-sm shrink-0"><Icon name="plus" className="h-3.5 w-3.5" />Add</Link>}
                      </li>
                    );
                  })}
                </ul>
              </Card>
      </section>
      {d.inventory.length > 0 && (
        <FromBook label="From the book: your coach, your feed, your engine" className="mt-6">
          {d.inventory.filter((i) => ["Your coach", "Your feed", "Your engine"].includes(i.label)).map((i) => (
            <p key={i.label} className="mt-2"><span className="font-medium text-ink">{i.label}. </span>{i.text}</p>
          ))}
          <Source>Both Hands on the Wheel, Your Design Inventory</Source>
        </FromBook>
      )}
    </>
  );
}

/** A section title on the page: serif, with an optional note or chip on the right. */
function SectionHead({ title, sub, meta }: { title: string; sub?: string; meta?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="h2">{title}</h2>
        {meta}
      </div>
      {sub && <p className="mt-1 text-sm text-ink-soft">{sub}</p>}
    </div>
  );
}

/** Book passages fold under one small line, so the page shows the client's own road first. */
function FromBook({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <details className={`mb-5 text-sm ${className}`}>
      <summary className="cursor-pointer text-link">{label}</summary>
      <div className="mt-2 text-ink-soft leading-relaxed">{children}</div>
      {label.startsWith("From the book") && <ReadTheBook kind="passage" className="mt-2" />}
    </details>
  );
}

/** Sets or changes a routine's day and time. Routines with one show up on the client's calendar link. */
function ScheduleEdit({ c }: { c: { id: string; cadence: string; when: string; days: string; time: string; startsOn: Date | null } }) {
  const on = isScheduled(c);
  const s = scheduleOf(c);
  const dayLabel = s.days.length ? daysToText(s.days) : "";
  return (
    <details className="mt-1 text-sm">
      <summary className="cursor-pointer text-link">{on ? "Change day or time" : "Set a day and time for my calendar"}</summary>
      <form action={updateCommitmentSchedule} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={c.id} />
        <label className="block"><span className="sr-only">Which days</span>
          <select name="whenDays" defaultValue={DAY_CHOICES.includes(dayLabel) ? dayLabel : ""} className="input !py-2 max-w-[180px]">
            {DAY_CHOICES.map((d) => <option key={d} value={d}>{d || "Any day"}</option>)}
          </select>
        </label>
        <label className="block"><span className="sr-only">Time</span><input type="time" name="whenTime" defaultValue={s.time} className="input !py-2 max-w-[150px]" /></label>
        <Submit className="btn-quiet !px-4 !py-2 text-sm">Save</Submit>
      </form>
    </details>
  );
}
