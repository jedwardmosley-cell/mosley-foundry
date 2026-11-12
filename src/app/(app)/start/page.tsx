import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { aiAvailable } from "@/lib/ai";
import { getJourney, JOURNEY_STEPS } from "@/lib/journey";
import { saveIdentity } from "@/app/actions/identity";
import { saveStatement, addCommitment, addRelationship } from "@/app/actions/participant";
import { PageHeader, Card, PillarMark, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { Picks, DictationHint } from "@/components/Picks";
import { PrefixedBox } from "@/components/PrefixedBox";
import { ForgeLinesFields } from "@/components/ForgeLinesFields";
import { RelationshipFields } from "@/components/RelationshipFields";
import { LEVELS, IDENTITY_LEVELS, PICKS_STATUS, STATEMENT_STARTERS, type IdentityLevel } from "@/content/identity";
import { BLUEPRINT_PICKS } from "@/content/options";
import { FORGE_IDENTITY_INTRO } from "@/content/forgeIdentityIntro";
import { PRACTICE_STARTERS } from "@/content/forgeLines";
import { RELATIONSHIP_ROLES, type PathwayKey } from "@/content/program";

export const metadata = { title: "Your first session" };

const STEP_COPY = [
  { title: "Claim who you are", intro: "Start with who you are. Write it as true today, the way you would say it out loud." },
  { title: "Write your FORGE identity", intro: `${FORGE_IDENTITY_INTRO} Start with F. If you get stuck, save what you have and finish the rest during your first week.` },
  { title: "See where you are today", intro: "Score yourself on the five pillars against the person you just described. Then pick one pillar to work on first." },
  { title: "Design your road", intro: "Discipline by Design turns your identity into practice. Add one routine that reinforces who you are, and one person who will know whether you did it." },
  { title: "Start your 30 days", intro: "Practice one behavior for 30 days, with a two-minute check-in each day. On day 30 you decide what comes next." },
];

/**
 * The guided first session: the five journey steps in order, one screen each.
 * It reuses the same saves as the full pages, so nothing here is stored twice.
 * A coach can also walk a client through it live.
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const sp = await searchParams;
  const journey = await getJourney(u.id);
  const firstOpen = JOURNEY_STEPS.findIndex((s) => !journey.done[s.key]);
  const asked = Number(sp.step);
  const step = asked >= 1 && asked <= 5 ? asked : firstOpen === -1 ? 0 : firstOpen + 1;

  if (step === 0 || (journey.done.drive && !sp.step)) {
    return (
      <>
        <PageHeader eyebrow="Your first session" title="You are set up" />
        <Card>
          <p className="text-[15px]">Your 30 days are under way. Each day, open Today and check in. It takes about two minutes.</p>
          <Link href="/dashboard" className="btn-primary mt-4 inline-flex">Go to Today</Link>
        </Card>
      </>
    );
  }

  const [profile, identity, assessment, commitments, people, { pack, entrepreneur }] = await Promise.all([
    db.profile.findUnique({ where: { userId: u.id } }),
    db.identityProfile.findUnique({ where: { userId: u.id }, select: { level: true, becoming: true } }),
    db.assessment.findFirst({ where: { userId: u.id, isSecondOpinion: false }, orderBy: { completedAt: "desc" }, select: { id: true } }),
    db.commitment.findMany({ where: { userId: u.id, active: true }, select: { id: true, title: true, when: true } }),
    db.relationship.findMany({ where: { ownerId: u.id, active: true }, select: { id: true, name: true, role: true } }),
    getContent(),
  ]);
  const pathway = (profile?.pathway ?? "PERSONAL") as PathwayKey;
  const claim = identity?.becoming.replace(/^(i am|i'm)\s+/i, "") ?? "";
  const ai = aiAvailable() && profile?.aiEnabled !== false;
  const priority = pack.pillars.find((p) => p.key === profile?.priorityPillar);
  const copy = STEP_COPY[step - 1];
  const next = `/start?step=${step + 1}`;
  const nextLabel = step < 5 ? `Next: ${STEP_COPY[step].title.toLowerCase()}` : "";

  return (
    <>
      <PageHeader eyebrow={`Your first session · Step ${step} of 5`} title={copy.title}>{copy.intro}</PageHeader>

      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Steps">
        {JOURNEY_STEPS.map((s, i) => (
          <li key={s.key}>
            <Link href={`/start?step=${i + 1}`} aria-current={i + 1 === step ? "step" : undefined}
              className={`chip ${i + 1 === step ? "!border-navy !text-navy font-medium" : journey.done[s.key] ? "!border-sage/50 !text-sage" : ""}`}>
              {i + 1}. {s.label}{journey.done[s.key] ? " ✓" : ""}
            </Link>
          </li>
        ))}
      </ol>

      {step === 1 && (identity ? (
        <Card>
          <p className="eyebrow">Who I am</p>
          <p className="mt-2 font-serif text-lg leading-relaxed">{identity.becoming}</p>
          <p className="text-sm muted mt-1">Level {LEVELS[identity.level as IdentityLevel].n} · {LEVELS[identity.level as IdentityLevel].name}. You can change it any time in <Link href="/identity" className="btn-link">Identity shift</Link>.</p>
          <Link href={next} className="btn-primary mt-4 inline-flex">{nextLabel}</Link>
        </Card>
      ) : (
        <Card>
          <form action={saveIdentity} className="space-y-6">
            <input type="hidden" name="next" value="/start" />
            <div>
              <label htmlFor="claim" className="label">Who are you? Claim it.</label>
              <PrefixedBox name="claim" prefix="I am" saved="" placeholder="a leader who operates with integrity" />
              <Picks list={{ status: PICKS_STATUS, options: STATEMENT_STARTERS[pathway] }} target="claim" label="Tap one to start, then make it yours" />
            </div>
            <fieldset>
              <legend className="label">How big a change is this?</legend>
              <p className="text-sm muted mb-3">No level ranks above another. Pick the one that fits where you are.</p>
              <div className="space-y-2">
                {IDENTITY_LEVELS.map((k) => (
                  <label key={k} className="flex gap-3 rounded-xl border border-line bg-white p-3.5 cursor-pointer has-[:checked]:border-navy has-[:checked]:ring-1 has-[:checked]:ring-navy/20">
                    <input type="radio" name="level" value={k} required className="mt-1" />
                    <span>
                      <span className="font-medium">Level {LEVELS[k].n} · {LEVELS[k].name}</span>
                      <span className="block text-sm text-ink-soft">{LEVELS[k].line} {LEVELS[k].forWhom}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-ink-mute">You can add why now, the behavior that shows it, and the rest later in identity shift.</p>
            <Submit>Save and continue</Submit>
          </form>
        </Card>
      ))}

      {step === 2 && (
        <Card>
          <form action={saveStatement} className="space-y-6">
            <input type="hidden" name="next" value="/start" />
            <ForgeLinesFields profile={profile} pathway={pathway} claim={claim} ai={ai}
              statementHint={profile?.pathway === "ENTREPRENEURIAL" && entrepreneur ? entrepreneur.forgeStatementPrompt : pack.forgeStatementPrompt} />
            <DictationHint />
            <Submit>Save and continue</Submit>
          </form>
        </Card>
      )}

      {step === 3 && (
        <Card>
          {!assessment ? (
            <>
              <p className="text-[15px]">Tap a score from 1 to 5 for each pillar. It takes about five minutes. Score what you do today. A 3 is a fine place to start.</p>
              <Link href="/assessment?next=start" className="btn-primary mt-4 inline-flex">Take the FORGE assessment</Link>
            </>
          ) : !priority ? (
            <>
              <p className="text-[15px]">Your scores are in. Pick the one pillar you will work on first.</p>
              <Link href={`/assessment/${assessment.id}?next=start`} className="btn-primary mt-4 inline-flex">See my results and pick a pillar</Link>
            </>
          ) : (
            <>
              <p className="eyebrow">My focus for the first 30 days</p>
              <p className="mt-3 flex items-center gap-2 h3"><PillarMark k={priority.key} /> {priority.name}</p>
              <p className="text-sm muted mt-2">To change it, open your <Link href={`/assessment/${assessment.id}?next=start`} className="btn-link">results</Link>.</p>
              <Link href={next} className="btn-primary mt-4 inline-flex">{nextLabel}</Link>
            </>
          )}
        </Card>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <Card>
            <h2 className="h3">One routine</h2>
            {commitments.length > 0 && <ul className="mt-2 space-y-1 text-[15px]">{commitments.map((c) => <li key={c.id}>✓ {c.title}{c.when ? <span className="text-ink-mute"> · {c.when}</span> : null}</li>)}</ul>}
            <form action={addCommitment} className="mt-4 space-y-3">
              <input type="hidden" name="next" value="/start" />
              <input type="hidden" name="area" value="ROUTINES" />
              <input type="hidden" name="cadence" value="DAILY" />
              <Field label={commitments.length ? "Add another (optional)" : "What will you do?"}>
                <input name="title" required maxLength={200} className="input" />
              </Field>
              <Picks list={priority ? { status: "draft", options: [...PRACTICE_STARTERS[priority.key][pathway], ...BLUEPRINT_PICKS.ROUTINES.options] } : BLUEPRINT_PICKS.ROUTINES} target="title" label={priority ? `Practices that reinforce your ${priority.name} identity, then others` : undefined} />
              <Field label="When">
                <select name="whenDays" className="input" defaultValue="Every day">
                  {["Every day", "Weekdays", "Weekends"].map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
              <Submit className="btn-quiet">Add routine</Submit>
            </form>
          </Card>
          <Card>
            <h2 className="h3">One person</h2>
            <p className="text-sm muted mt-1">Start with an accountability partner: someone who will ask whether you did it.</p>
            {people.length > 0 && <ul className="mt-2 space-y-1 text-[15px]">{people.map((p) => <li key={p.id}>✓ {p.name} <span className="text-ink-mute">· {RELATIONSHIP_ROLES[p.role as keyof typeof RELATIONSHIP_ROLES]}</span></li>)}</ul>}
            <form action={addRelationship} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="next" value="/start" />
              <label className="block sm:col-span-2"><span className="label">{people.length ? "Add another (optional)" : "Name"}</span><input name="name" required maxLength={120} className="input" /></label>
              <RelationshipFields />
              <div className="sm:col-span-2"><Submit className="btn-quiet">Add person</Submit></div>
            </form>
            <p className="text-xs text-ink-mute mt-3">They do not see your records. You can add mentors, mentees and groups later in your blueprint.</p>
          </Card>
          {commitments.length > 0 && people.length > 0 && <Link href={next} className="btn-primary inline-flex">{nextLabel}</Link>}
        </div>
      )}

      {step === 5 && (
        <Card>
          <p className="eyebrow">Your road</p>
          <dl className="mt-3 space-y-3 text-[15px]">
            {identity && <div><dt className="text-ink-mute text-sm">Who I am</dt><dd className="font-serif text-lg">{identity.becoming}</dd></div>}
            {(profile?.forgeStatement || profile?.destination) && <div><dt className="text-ink-mute text-sm">My FORGE statement</dt><dd>{profile.forgeStatement || profile.destination}</dd></div>}
            {priority && <div><dt className="text-ink-mute text-sm">My focus</dt><dd className="flex items-center gap-2"><PillarMark k={priority.key} /> {priority.name}</dd></div>}
            {commitments[0] && <div><dt className="text-ink-mute text-sm">My routine</dt><dd>{commitments.map((c) => c.title).join(", ")}</dd></div>}
            {people[0] && <div><dt className="text-ink-mute text-sm">My people</dt><dd>{people.map((p) => p.name).join(", ")}</dd></div>}
          </dl>
          {journey.done.drive ? (
            <Link href="/dashboard" className="btn-primary mt-5 inline-flex">Your 30 days are under way. Go to Today</Link>
          ) : (
            <Link href={`/cycle/new${priority ? `?pillar=${priority.key}` : ""}`} className="btn-primary mt-5 inline-flex">Choose my behavior and start my 30 days</Link>
          )}
        </Card>
      )}

      <div className="mt-6 flex items-center justify-between text-sm">
        {step > 1 ? <Link href={`/start?step=${step - 1}`} className="text-ink-soft hover:text-ink">Back</Link> : <span />}
        {step < 5 && <Link href={next} className="text-ink-soft hover:text-ink">Skip for now</Link>}
      </div>
    </>
  );
}
