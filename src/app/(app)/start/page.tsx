import { fiveLines } from "@/content/forgeLines";
import Link from "next/link";
import { ReadTheBook } from "@/components/ReadTheBook";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { aiAvailable } from "@/lib/ai";
import { getJourney, JOURNEY_STEPS } from "@/lib/journey";
import { saveWhoIAm } from "@/app/actions/identity";
import { addCommitment, addRelationship, makeAccountabilityPartner, startCycle } from "@/app/actions/participant";
import { linesOf } from "@/content/forgeLines";
import { CycleFocusFields } from "@/components/CycleFocusFields";
import { pillarScores } from "@/lib/focus";
import { PageHeader, Card, PillarMark, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { StatementReveal } from "@/components/StatementReveal";
import { Picks } from "@/components/Picks";
import { FiveSides, MyStatement } from "@/components/ForgeLinesFields";
import { DistanceStart } from "@/components/DistanceStart";
import { widestGapFor } from "@/lib/distanceData";
import { LEVELS, IDENTITY_LEVELS, type IdentityLevel } from "@/content/identity";
import { ROLE_PICKS, WHO_I_AM_STATUS, KIND_NOTE, WHO_TITLE, WHO_HEADINGS, withArticle } from "@/content/whoIAm";
import { BLUEPRINT_PICKS } from "@/content/options";
import { getForgeSource } from "@/content/forgeSource";
import { PRACTICE_STARTERS } from "@/content/forgeLines";
import { PATHWAYS, BLUEPRINT_AREAS, RELATIONSHIP_ROLES, type PathwayKey } from "@/content/program";
import type { PillarKey } from "@/content/types";

export const metadata = { title: "Getting in the Driver's Seat" };

const STEP_COPY = [
  { title: WHO_TITLE, intro: "The FORGE framework, applied to you. Three short parts." },
  { title: "The Rules of the Road", intro: "Rate yourself on the five rules as the person you just described. This is the work to sit with." },
  { title: "Choose your focus", intro: "One or two things to work on, and that's it. Five short questions turn each one into a plan for 30 days, and one person finds out." },
  { title: "Build your system", intro: "Discipline by Design is the structure around your focus. Three pieces, one screen each: a daily routine, a weekly planning time and an accountability partner. Your daily check-in opens once they're in place." },
];

/**
 * The guided first session: the five journey steps in order, one screen each.
 * It reuses the same saves as the full pages, so nothing here is stored twice.
 * A coach can also walk a client through it live.
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ step?: string; part?: string; edit?: string; missingLines?: string; pillar?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const sp = await searchParams;
  const needLines = (sp.missingLines ?? "").split("").filter((c) => "FORGE".includes(c));
  const journey = await getJourney(u.id);
  const firstOpen = JOURNEY_STEPS.findIndex((s) => !journey.done[s.key]);
  const asked = Number(sp.step);
  const step = asked >= 1 && asked <= 4 ? asked : firstOpen === -1 ? 0 : firstOpen + 1;

  if (step === 0) {
    return (
      <>
        <PageHeader eyebrow="Getting in the Driver's Seat" title="You are set up" />
        <Card>
          <p className="text-[15px]">Your focus is set and your road is in place. Each day, open the Dashboard and check in. On Saturday, look back on the week.</p>
          <Link href="/dashboard" className="btn-primary mt-4 inline-flex">Go to the Dashboard</Link>
        </Card>
        <ReadTheBook className="mt-5" />
      </>
    );
  }

  const [profile, identity, assessment, commitments, people, focuses, { pack, entrepreneur }, forge] = await Promise.all([
    db.profile.findUnique({ where: { userId: u.id } }),
    db.identityProfile.findUnique({ where: { userId: u.id }, select: { level: true, becoming: true, role: true } }),
    db.assessment.findFirst({ where: { userId: u.id, isSecondOpinion: false }, orderBy: { completedAt: "desc" } }),
    db.commitment.findMany({ where: { userId: u.id, active: true }, select: { id: true, title: true, when: true, area: true } }),
    db.relationship.findMany({ where: { ownerId: u.id, active: true }, select: { id: true, name: true, role: true } }),
    db.developmentCycle.findMany({ where: { userId: u.id, status: "ACTIVE" }, orderBy: [{ slot: "asc" }, { startDate: "asc" }], select: { id: true, title: true, focus: true, plan: true, pillar: true, setupDoneAt: true } }),
    getContent(),
    getForgeSource(),
  ]);
  const pathway = (profile?.pathway ?? "PERSONAL") as PathwayKey;
  // Step 4 builds the system: 1 a daily routine, 2 a weekly planning time, 3 an accountability partner, then done (4).
  const daily = commitments.filter((c) => c.area === "ROUTINES");
  const weekly = commitments.filter((c) => c.area === "WEEKLY");
  const partners = people.filter((x) => x.role === "ACCOUNTABILITY_PARTNER");
  const firstMissing = !daily.length ? 1 : !weekly.length ? 2 : !partners.length ? 3 : 4;
  const part = step === 4
    ? ([1, 2, 3].includes(Number(sp.part)) ? Number(sp.part) : firstMissing)
    : [1, 2, 3].includes(Number(sp.part)) ? Number(sp.part) : 1;
  const role = identity?.role ?? "";
  const ai = aiAvailable() && profile?.aiEnabled !== false;
  const priority = pack.pillars.find((p) => p.key === profile?.priorityPillar);
  const useEntre = profile?.pathway === "ENTREPRENEURIAL" && !!entrepreneur;
  const instrument = pack.assessmentStatus === "draft" ? "FORGE_DRAFT" : useEntre ? "FORGE_ENTREPRENEUR" : "FORGE_PERSONAL";
  const scores = assessment ? pillarScores(assessment) : ({ F: 0, O: 0, R: 0, G: 0, E: 0 } as Record<PillarKey, number>);
  // Focus ideas start from the lowest score. Nothing is labeled a weakness.
  // From the distance check: the rule they tapped "Make it my focus" on, otherwise its widest gap.
  const picked = ["F", "O", "R", "G", "E"].includes(sp.pillar ?? "") ? (sp.pillar as PillarKey) : null;
  const lowest = picked ?? (await widestGapFor(assessment?.id)) ?? (assessment ? (["F", "O", "R", "G", "E"] as PillarKey[]).reduce((a, k) => (scores[k] < scores[a] ? k : a), "F" as PillarKey) : (priority?.key as PillarKey | undefined)) ?? "F";
  const template = pack.thirtyDayPlan.length ? PATHWAYS[pathway].cycleTemplate : "NIRS_30";
  const copy = STEP_COPY[step - 1];
  const next = `/start?step=${step + 1}`;
  const backHref = step === 1 ? (part > 1 ? `/start?step=1&part=${part - 1}` : null) : step === 2 ? "/start?step=1&part=3" : step === 4 && part > 1 ? `/start?step=4&part=${part - 1}` : `/start?step=${step - 1}`;
  const skipHref = step === 1 ? (part < 3 ? `/start?step=1&part=${part + 1}` : next) : step === 2 ? next : null;
  const nextLabel = step < 4 ? `Next: ${STEP_COPY[step].title.toLowerCase()}` : "";

  return (
    <>
      <ol className="mb-5 grid grid-cols-4 gap-1.5" aria-label="Steps">
        {JOURNEY_STEPS.map((s, i) => (
          <li key={s.key}>
            <Link href={`/start?step=${i + 1}`} aria-current={i + 1 === step ? "step" : undefined} className="block">
              <span className={`block h-1.5 rounded-full ${i + 1 === step ? "bg-heading" : journey.done[s.key] ? "bg-navy" : "bg-line"}`} />
              <span className="sr-only">Step {i + 1}: {s.label}{journey.done[s.key] ? " (done)" : ""}</span>
            </Link>
          </li>
        ))}
      </ol>
      <PageHeader eyebrow={`Getting in the Driver's Seat, step ${step} of 4${step === 1 || (step === 4 && part < 4) ? `, part ${part} of 3` : ""}`} title={copy.title}>{step === 4 && part === 4 ? "Your system is set up." : step === 4 && (daily.length || weekly.length) ? "Three pieces, one screen each. Your daily check-in opens once they're in place." : copy.intro}</PageHeader>

      {step === 1 && part === 1 && (
        <Card>
          <form action={saveWhoIAm} className="space-y-6">
            <input type="hidden" name="next" value="/start?step=1&part=2" />
            <div>
              <label htmlFor="role" className="label">{WHO_HEADINGS.role}</label>
              <div className="flex items-center inputbox">
                <span className="pl-3.5 pr-1.5 py-2.5 text-[15px] text-ink-soft whitespace-nowrap">This is about me as</span>
                <input id="role" name="role" defaultValue={role} maxLength={80} placeholder={withArticle(ROLE_PICKS[pathway][0])} className="flex-1 min-w-0 bg-transparent py-2.5 pr-3 text-[15px] focus:outline-none" />
              </div>
              <Picks list={{ status: WHO_I_AM_STATUS, options: ROLE_PICKS[pathway] }} target="role" label="Tap one, or write your own" />
            </div>
            <fieldset>
              <legend className="label">{WHO_HEADINGS.kind}</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {IDENTITY_LEVELS.map((k) => (
                  <label key={k} className="cursor-pointer">
                    <input type="radio" name="level" value={k} required defaultChecked={identity?.level === k} className="peer sr-only" />
                    <span className="option h-full">
                      <span className="block font-medium text-[15px]">{LEVELS[k].name}</span>
                      <span className="mt-1 block text-sm text-ink-soft">{LEVELS[k].line}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-sm text-ink-soft">{KIND_NOTE}</p>
            </fieldset>
            <Submit>Save and continue</Submit>
          </form>
        </Card>
      )}

      {step === 1 && part === 2 && (
        <Card>
          <form action={saveWhoIAm} className="space-y-6">
            <input type="hidden" name="next" value="/start?step=1&part=3" />
            {needLines.length > 0
              ? <p role="status" className="notice">Where I am measures you against your own lines. Write your {needLines.join(", ")} line{needLines.length > 1 ? "s" : ""} first, then come back.</p>
              : <p className="text-sm text-ink-soft">Start with F. If you get stuck, save what you have and finish the rest later.</p>}
            <FiveSides profile={profile} pathway={pathway} role={role} level={identity?.level ?? ""} ai={ai} opening={forge?.intro} guide={forge?.guide?.rules ?? {}} teach={forge?.cards ?? {}} rules={Object.fromEntries(pack.pillars.map((p) => [p.key, p.short]))} faith={pack.faith?.forge ?? {}} />
            <Submit>Save and continue</Submit>
          </form>
        </Card>
      )}

      {step === 1 && part === 3 && (
        <Card>
          <form action={saveWhoIAm} className="space-y-5">
            <input type="hidden" name="next" value="/start?step=2" />
            <MyStatement statement={profile?.forgeStatement || identity?.becoming || ""} ai={ai} saved={profile}
              hint={profile?.pathway === "ENTREPRENEURIAL" && entrepreneur ? entrepreneur.forgeStatementPrompt : pack.forgeStatementPrompt} />
            <StatementReveal label="Save and continue" saved={fiveLines(profile)} />
          </form>
        </Card>
      )}

      {step === 2 && (
        <Card>
          {/* Where I am: measured against their own five lines, one rule at a time. */}
          <p className="mb-5 text-[15px]">This measures you against your own future self: the five lines you just wrote. For each rule, you&apos;ll say how often you were that person this week, name a real moment from this week, and choose what you&apos;d do in one situation. It takes about fifteen minutes.</p>
          <DistanceStart userId={u.id} from="start" />
          {assessment && <Link href={next} className="btn-quiet mt-5 inline-flex">{nextLabel}</Link>}
        </Card>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <ol className="space-y-1.5" aria-label="Your system">
            {[["A daily routine", daily], ["A weekly planning time", weekly], ["An accountability partner", partners]].map(([label, list], i) => {
              const have = (list as { id: string }[]).length > 0;
              return (
                <li key={i}>
                  <Link href={`/start?step=4&part=${i + 1}`} className={`flex items-center gap-3 text-[15px] ${part === i + 1 ? "font-medium text-heading" : have ? "text-ink-mute" : "text-ink-soft"}`}>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${have ? "bg-navy text-white" : "border border-ink/20"}`}>{have ? "✓" : i + 1}</span>
                    {label as string}{have && <span className="sr-only"> (done)</span>}
                  </Link>
                </li>
              );
            })}
          </ol>

          {part === 1 && (
            <Card>
              <h2 className="h3">A daily routine</h2>
              <p className="mt-1 text-sm text-ink-soft">{BLUEPRINT_AREAS.find((x) => x.key === "ROUTINES")!.hint} Something small you do every day that builds your focus into your week.</p>
              {daily.length > 0 && <p className="mt-3 text-[15px]">✓ {daily.map((c) => c.title).join(", ")}</p>}
              <form action={addCommitment} className="mt-4 space-y-3">
                <input type="hidden" name="next" value="/start" />
                <input type="hidden" name="area" value="ROUTINES" />
                <input type="hidden" name="cadence" value="DAILY" />
                <Field label={daily.length ? "Add another (optional)" : "What will you do?"}>
                  <input name="title" required maxLength={200} className="input" />
                </Field>
                <Picks list={priority ? { status: "draft", options: [...PRACTICE_STARTERS[priority.key][pathway], ...BLUEPRINT_PICKS.ROUTINES.options] } : BLUEPRINT_PICKS.ROUTINES} target="title" folded="Ideas" />
                <div className="grid gap-3 grid-cols-2">
                  <Field label="Which days">
                    <select name="whenDays" className="input" defaultValue="Every day">
                      {["Every day", "Weekdays", "Weekends"].map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="Time (optional)"><input type="time" name="whenTime" className="input" /></Field>
                </div>
                <Submit className={daily.length ? "btn-quiet" : "btn-primary"}>Add daily routine</Submit>
              </form>
              {daily.length > 0 && <Link href="/start?step=4&part=2" className="btn-primary mt-4 inline-flex">Next: a weekly planning time</Link>}
            </Card>
          )}

          {part === 2 && (
            <Card>
              <h2 className="h3">A weekly planning time</h2>
              <p className="mt-1 text-sm text-ink-soft">{BLUEPRINT_AREAS.find((x) => x.key === "WEEKLY")!.hint}</p>
              {weekly.length > 0 && <p className="mt-3 text-[15px]">✓ {weekly.map((c) => [c.title, c.when].filter(Boolean).join(", ")).join("; ")}</p>}
              <form action={addCommitment} className="mt-4 space-y-3">
                <input type="hidden" name="next" value="/start" />
                <input type="hidden" name="area" value="WEEKLY" />
                <input type="hidden" name="cadence" value="WEEKLY" />
                <Field label={weekly.length ? "Add another (optional)" : "What will you do?"}>
                  <input name="title" required maxLength={200} defaultValue={weekly.length ? "" : "Plan the week ahead"} className="input" />
                </Field>
                <Picks list={BLUEPRINT_PICKS.WEEKLY} target="title" folded="Ideas" />
                <div className="grid gap-3 grid-cols-2">
                  <Field label="Which day">
                    <select name="whenDays" className="input" defaultValue="Sunday">
                      {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="Time (optional)"><input type="time" name="whenTime" className="input" /></Field>
                </div>
                <Submit className={weekly.length ? "btn-quiet" : "btn-primary"}>Add weekly planning time</Submit>
              </form>
              {weekly.length > 0 && <Link href="/start?step=4&part=3" className="btn-primary mt-4 inline-flex">Next: an accountability partner</Link>}
            </Card>
          )}

          {part === 3 && (
            <Card>
              <h2 className="h3">An accountability partner</h2>
              <p className="mt-1 text-sm text-ink-soft">{BLUEPRINT_AREAS.find((x) => x.key === "ACCOUNTABILITY")!.hint} Someone who checks in with you on a schedule.</p>
              {partners.length > 0 && <p className="mt-3 text-[15px]">✓ {partners.map((x) => x.name).join(", ")}</p>}
              {partners.length === 0 && people.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-ink-soft">Someone already on your list?</p>
                  {people.map((x) => (
                    <form key={x.id} action={makeAccountabilityPartner} className="flex items-center justify-between gap-3 rounded-2xl bg-ink/[0.04] px-4 py-2.5">
                      <input type="hidden" name="id" value={x.id} />
                      <input type="hidden" name="next" value="/start" />
                      <span className="text-[15px]">{x.name}<span className="text-sm text-ink-mute">, {RELATIONSHIP_ROLES[x.role as keyof typeof RELATIONSHIP_ROLES] ?? x.role}</span></span>
                      <Submit className="btn-quiet !py-1.5 text-sm">Make {x.name.split(" ")[0]} my partner</Submit>
                    </form>
                  ))}
                  <p className="pt-2 text-sm text-ink-soft">Or add someone new:</p>
                </div>
              )}
              <form action={addRelationship} className="mt-4 space-y-3">
                <input type="hidden" name="next" value="/start" />
                <input type="hidden" name="role" value="ACCOUNTABILITY_PARTNER" />
                <Field label={partners.length ? "Add another (optional)" : "Name"}>
                  <input name="name" required maxLength={120} className="input" />
                </Field>
                <Field label="How often you'll check in">
                  <select name="cadenceDays" className="input" defaultValue="7">
                    <option value="7">Every week</option>
                    <option value="14">Every two weeks</option>
                    <option value="30">Every month</option>
                  </select>
                </Field>
                <input type="hidden" name="purpose" value="Checks on my focus" />
                <Submit className={partners.length ? "btn-quiet" : "btn-primary"}>Add accountability partner</Submit>
              </form>
              {partners.length > 0 && firstMissing === 4 && <Link href="/start?step=4" className="btn-primary mt-4 inline-flex">Next: finish</Link>}
            </Card>
          )}

          {part === 4 && (
            <Card>
              <p className="text-[15px]">Your system is in place. Each day, open the Dashboard and check in. On Saturday, look back on the week. The rest of the Vehicle Controls (mentors, learning, groups and more) is there when you&apos;re ready.</p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Link href="/dashboard" className="btn-primary inline-flex">Finish and go to the Dashboard</Link>
                <Link href="/settings" className="text-sm btn-link">Put it on my calendar</Link>
              </div>
            </Card>
          )}
        </div>
      )}

      {step === 3 && (
        <Card>
          {focuses.length === 0 ? (
            <form action={startCycle} className="space-y-5">
              <input type="hidden" name="next" value="start" />
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="template" value={template} />
              <input type="hidden" name="season" value="" />
              <CycleFocusFields pillars={pack.pillars.map((p) => ({ key: p.key, name: p.name }))} initial={lowest} />
              <Submit>Next: five short questions</Submit>
            </form>
          ) : (
            <>
              <p className="eyebrow">The Windshield</p>
              <ul className="mt-3 space-y-3">
                {focuses.map((f) => (
                  <li key={f.id} className="flex items-start gap-3">
                    <PillarMark k={f.pillar as PillarKey} size="sm" />
                    <span className="flex-1">
                      <span className="block text-[16px] font-medium text-heading">{f.title || f.focus}</span>
                      {f.plan && <span className="block text-sm text-ink-soft">{f.plan}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {focuses.some((f) => !f.setupDoneAt) ? (
                <Link href="/cycle/setup?step=1" className="btn-primary mt-5 inline-flex">Finish setting it up</Link>
              ) : (
                <Link href={next} className="btn-primary mt-5 inline-flex">{nextLabel}</Link>
              )}
              {focuses.length === 1 && <p className="mt-3 text-sm text-ink-mute">One is plenty. You can add a second later, under the Windshield.</p>}
            </>
          )}
        </Card>
      )}

      <div className="mt-6 flex items-center justify-between text-sm">
        {backHref ? <Link href={backHref} className="text-ink-soft hover:text-ink">Back</Link> : <span />}
        {skipHref && <Link href={skipHref} className="text-ink-soft hover:text-ink">Skip for now</Link>}
      </div>
    </>
  );
}
