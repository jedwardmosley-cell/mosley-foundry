import { fiveLines } from "@/content/forgeLines";
import Link from "next/link";
import { ReadTheBook } from "@/components/ReadTheBook";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { aiAvailable } from "@/lib/ai";
import { getJourney, JOURNEY_STEPS } from "@/lib/journey";
import { saveWhoIAm } from "@/app/actions/identity";
import { addCommitment, startCycle } from "@/app/actions/participant";
import { AssessmentForm } from "@/components/AssessmentForm";
import { CycleFocusFields } from "@/components/CycleFocusFields";
import { pillarScores } from "@/lib/focus";
import { CYCLE_FOCUS } from "@/content/options";
import { PageHeader, Card, PillarMark, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { StatementReveal } from "@/components/StatementReveal";
import { Picks } from "@/components/Picks";
import { FiveSides, MyStatement } from "@/components/ForgeLinesFields";
import { LEVELS, IDENTITY_LEVELS, type IdentityLevel } from "@/content/identity";
import { ROLE_PICKS, WHO_I_AM_STATUS, KIND_NOTE, WHO_TITLE, WHO_HEADINGS, withArticle } from "@/content/whoIAm";
import { BLUEPRINT_PICKS } from "@/content/options";
import { getForgeSource } from "@/content/forgeSource";
import { PRACTICE_STARTERS } from "@/content/forgeLines";
import { PATHWAYS, type PathwayKey } from "@/content/program";
import type { PillarKey } from "@/content/types";

export const metadata = { title: "My first session" };

const STEP_COPY = [
  { title: WHO_TITLE, intro: "The FORGE framework, applied to you. Three short parts." },
  { title: "See where you are today", intro: "Score the five pillars as the person you just described. It takes about five minutes." },
  { title: "Choose your focus", intro: "One or two things to work on, and that's it. Five short questions turn each one into a plan for 30 days, and one person finds out." },
  { title: "What holds it in place", intro: "Discipline by Design: one routine with a day and a time. After that, a check-in each day and a look back each week." },
];

/**
 * The guided first session: the five journey steps in order, one screen each.
 * It reuses the same saves as the full pages, so nothing here is stored twice.
 * A coach can also walk a client through it live.
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ step?: string; part?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const sp = await searchParams;
  const journey = await getJourney(u.id);
  const firstOpen = JOURNEY_STEPS.findIndex((s) => !journey.done[s.key]);
  const asked = Number(sp.step);
  const step = asked >= 1 && asked <= 4 ? asked : firstOpen === -1 ? 0 : firstOpen + 1;

  if (step === 0) {
    return (
      <>
        <PageHeader eyebrow="My first session" title="You are set up" />
        <Card>
          <p className="text-[15px]">Your focus is set and your road is in place. Each day, open Today and check in. On Saturday, look back on the week.</p>
          <Link href="/dashboard" className="btn-primary mt-4 inline-flex">Go to Today</Link>
        </Card>
        <ReadTheBook className="mt-5" />
      </>
    );
  }

  const [profile, identity, assessment, commitments, people, focuses, { pack, entrepreneur }, forge] = await Promise.all([
    db.profile.findUnique({ where: { userId: u.id } }),
    db.identityProfile.findUnique({ where: { userId: u.id }, select: { level: true, becoming: true, role: true } }),
    db.assessment.findFirst({ where: { userId: u.id, isSecondOpinion: false }, orderBy: { completedAt: "desc" } }),
    db.commitment.findMany({ where: { userId: u.id, active: true }, select: { id: true, title: true, when: true } }),
    db.relationship.findMany({ where: { ownerId: u.id, active: true }, select: { id: true, name: true, role: true } }),
    db.developmentCycle.findMany({ where: { userId: u.id, status: "ACTIVE" }, orderBy: [{ slot: "asc" }, { startDate: "asc" }], select: { id: true, title: true, focus: true, plan: true, pillar: true, setupDoneAt: true } }),
    getContent(),
    getForgeSource(),
  ]);
  const pathway = (profile?.pathway ?? "PERSONAL") as PathwayKey;
  const part = [1, 2, 3].includes(Number(sp.part)) ? Number(sp.part) : 1;
  const role = identity?.role ?? "";
  const ai = aiAvailable() && profile?.aiEnabled !== false;
  const priority = pack.pillars.find((p) => p.key === profile?.priorityPillar);
  const useEntre = profile?.pathway === "ENTREPRENEURIAL" && !!entrepreneur;
  const instrument = pack.assessmentStatus === "draft" ? "FORGE_DRAFT" : useEntre ? "FORGE_ENTREPRENEUR" : "FORGE_PERSONAL";
  const scores = assessment ? pillarScores(assessment) : ({ F: 0, O: 0, R: 0, G: 0, E: 0 } as Record<PillarKey, number>);
  // Focus ideas start from the lowest score. Nothing is labeled a weakness.
  const lowest = (assessment ? (["F", "O", "R", "G", "E"] as PillarKey[]).reduce((a, k) => (scores[k] < scores[a] ? k : a), "F" as PillarKey) : (priority?.key as PillarKey | undefined)) ?? "F";
  const template = pack.thirtyDayPlan.length ? PATHWAYS[pathway].cycleTemplate : "NIRS_30";
  const copy = STEP_COPY[step - 1];
  const next = `/start?step=${step + 1}`;
  const backHref = step === 1 ? (part > 1 ? `/start?step=1&part=${part - 1}` : null) : step === 2 ? "/start?step=1&part=3" : `/start?step=${step - 1}`;
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
      <PageHeader eyebrow={`My first session · Step ${step} of 4${step === 1 ? `, part ${part} of 3` : ""} · ${step <= 2 ? "FORGE" : "Discipline by Design"}`} title={copy.title}>{copy.intro}</PageHeader>

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
            <p className="text-sm text-ink-soft">Start with F. If you get stuck, save what you have and finish the rest later.</p>
            <FiveSides profile={profile} pathway={pathway} role={role} level={identity?.level ?? ""} ai={ai} opening={forge?.intro} guide={forge?.guide?.rules ?? {}} teach={forge?.cards ?? {}} rules={Object.fromEntries(pack.pillars.map((p) => [p.key, p.short]))} />
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
          {!assessment ? (
            <>
              <p className="mb-5 text-[15px]">Tap a score from 1 to 5 for each pillar. Score what you did this past month. A 3 is a fine place to start.</p>
              <AssessmentForm pack={pack} entrepreneur={entrepreneur} useEntre={useEntre} instrument={instrument} next="/start" />
            </>
          ) : (
            <>
              <p className="eyebrow">My scores</p>
              <ul className="mt-4 space-y-3">
                {pack.pillars.map((p) => {
                  const v = scores[p.key as PillarKey];
                  return (
                    <li key={p.key} className="flex items-center gap-3">
                      <PillarMark k={p.key} size="sm" />
                      <span className="w-40 shrink-0 text-[15px]">{p.name}</span>
                      <span className="flex flex-1 gap-1" aria-hidden>{[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= v ? "bg-navy" : "bg-ink/[0.08]"}`} />)}</span>
                      <span className="w-14 text-right text-sm text-ink-soft">{v} of 5</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-sm text-ink-soft">The goal is a 5 on every one. It&apos;s a pursuit that doesn&apos;t end.</p>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <Link href={next} className="btn-primary inline-flex">{nextLabel}</Link>
                <Link href={`/assessment/${assessment.id}`} className="text-sm btn-link">See my full results</Link>
              </div>
            </>
          )}
        </Card>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <Card>
            <h2 className="h3">One routine that holds your focus in place</h2>
            {commitments.length > 0 && <p className="mt-2 text-[15px]">✓ {commitments[commitments.length - 1].title}{commitments.length > 1 && <span className="text-ink-mute"> and {commitments.length - 1} more</span>}</p>}
            <form action={addCommitment} className="mt-4 space-y-3">
              <input type="hidden" name="next" value="/start" />
              <input type="hidden" name="area" value="ROUTINES" />
              <input type="hidden" name="cadence" value="DAILY" />
              <Field label={commitments.length ? "Add another (optional)" : "What will you do?"}>
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
              <Submit className="btn-quiet">Add routine</Submit>
            </form>
          </Card>
          {people.length > 0 && (
            <Card>
              <h2 className="h3">Who checks on you</h2>
              <p className="mt-2 text-[15px]">✓ {people.map((x) => x.name).join(", ")}</p>
              <p className="mt-1 text-sm text-ink-soft">From &ldquo;Who finds out?&rdquo; in your focus. Add more people any time under People.</p>
            </Card>
          )}
          {commitments.length > 0 && (
            <Card>
              <p className="text-[15px]">That&apos;s everything. Each day, open Today and check in. On Saturday, look back on the week.</p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Link href="/dashboard" className="btn-primary inline-flex">Finish and go to Today</Link>
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
              <div>
                <label htmlFor="title" className="label">My focus, in a few words</label>
                <input id="title" name="title" required maxLength={160} placeholder="Stay curious when my decisions get challenged" className="input" />
                <div className="mt-2"><Picks list={CYCLE_FOCUS[lowest]} target="title" folded="Ideas" /></div>
              </div>
              <CycleFocusFields pillars={pack.pillars.map((p) => ({ key: p.key, name: p.name }))} initial={lowest} />
              <Submit>Next: five short questions</Submit>
            </form>
          ) : (
            <>
              <p className="eyebrow">My focus</p>
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
              {focuses.length === 1 && <p className="mt-3 text-sm text-ink-mute">One is plenty. You can add a second later, under My focus.</p>}
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
