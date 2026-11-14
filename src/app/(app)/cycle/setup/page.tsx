import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiAvailable } from "@/lib/ai";
import { FORGE_LINES } from "@/content/forgeLines";
import { SETUP_STEPS, FIRST_GUESS, AI_FEELING_NOTE, WHO_FINDS_OUT, FINDS_OUT_ROLES, MENTEE_ROLES, buildPlan } from "@/content/weekOne";
import { RELATIONSHIP_ROLES } from "@/content/program";
import { saveSetupStep, savePlan, addFindsOutPerson } from "@/app/actions/weekOne";
import { PillarMark, PILLAR_FILL } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { SetupWords } from "@/components/SetupWords";
import { SetupShare } from "@/components/SetupShare";

export const metadata = { title: "Week 1 setup" };

const TOTAL = SETUP_STEPS.length + 2; // five questions, the plan, and who finds out

/**
 * Week 1 setup: five screens, one question each, then the plan, then "Who finds out?".
 * Every answer is private. Sending the plan to someone completes setup.
 */
export default async function WeekOneSetup({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { step = "1" } = await searchParams;
  const cycle = await db.developmentCycle.findFirst({ where: { userId: u.id, status: "ACTIVE" }, orderBy: { startDate: "desc" } });
  if (!cycle) redirect("/cycle/new");
  const [profile, people] = await Promise.all([
    db.profile.findUnique({ where: { userId: u.id } }),
    db.relationship.findMany({ where: { ownerId: u.id, active: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, role: true, email: true } }),
  ]);
  const ai = aiAvailable() && profile?.aiEnabled !== false;
  const n = step === "plan" ? 6 : step === "share" ? 7 : Math.min(Math.max(Number(step) || 1, 1), 5);
  const bar = (
    <>
      <div className="flex items-center justify-between text-sm text-ink-mute">
        <span>Week 1 setup{n <= 5 ? ` · ${n} of 5` : ""}</span>
        <Link href="/dashboard" className="hover:text-ink">Finish later</Link>
      </div>
      <div className="mt-2 mb-8 flex gap-1" aria-hidden>{Array.from({ length: TOTAL }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < n ? "bg-navy" : "bg-ink/[0.08]"}`} />)}</div>
    </>
  );
  const back = n > 1 ? `/cycle/setup?step=${n - 1 === 6 ? "plan" : n - 1}` : "/cycle";

  // Screens 1 to 5: one question each.
  if (n <= 5) {
    const s = SETUP_STEPS[n - 1];
    const next = n < 5 ? `/cycle/setup?step=${n + 1}` : "/cycle/setup?step=plan";
    const tone = s.show === "E" || s.show === "G" ? ({ "--pc": `var(${PILLAR_FILL[s.show].cssVar})` } as CSSProperties) : undefined;
    const lineFor = (k: "E" | "G") => profile?.[FORGE_LINES.find((l) => l.pillar === k)!.field] ?? "";
    return (
      <article style={tone} className="max-w-xl">
        {bar}
        <form action={saveSetupStep}>
          <input type="hidden" name="field" value={s.field} />
          <input type="hidden" name="next" value={next} />
          <p className="section-label" style={tone ? { color: "rgb(var(--pc))" } : undefined}>{s.label}</p>
          <label htmlFor="value" className="mt-2 block font-serif text-[30px] leading-[1.15] tracking-[-0.01em] text-heading">{s.question}</label>
          <p className="mt-2 text-[15px] text-ink-soft">{s.hint}</p>
          {(s.show === "E" || s.show === "G") && lineFor(s.show) && (
            <div className="mt-5 rounded-2xl px-4 py-3.5" style={{ background: "rgb(var(--pc) / 0.08)" }}>
              <p className="section-label" style={{ color: "rgb(var(--pc))" }}>My {s.show} line</p>
              <p className="mt-1.5 font-serif text-[17px] leading-snug text-heading">{lineFor(s.show)}</p>
            </div>
          )}
          {s.show === "five" && (
            <ul className="mt-5 space-y-2">
              {FORGE_LINES.filter((l) => profile?.[l.field]).map((l) => (
                <li key={l.pillar} className="flex gap-2.5"><PillarMark k={l.pillar} size="sm" /><span className="font-serif text-[16px] leading-snug text-heading">{profile?.[l.field]}</span></li>
              ))}
            </ul>
          )}
          <textarea id="value" name="value" defaultValue={cycle[s.field]} placeholder={s.placeholder} maxLength={1500} className="textarea mt-5 !min-h-[96px]" />
          <span className="chip mt-2">{FIRST_GUESS}</span>
          {ai && <SetupWords field={s.field} note={s.field === "feeling" ? AI_FEELING_NOTE : undefined} />}
          <div className="mt-10 flex items-center justify-between">
            <Link href={back} className="text-[15px] btn-link">Back</Link>
            <Submit>Next</Submit>
          </div>
        </form>
      </article>
    );
  }

  // The plan, built from the answers. The client can change the wording.
  if (n === 6) {
    const draft = cycle.plan || buildPlan(cycle);
    return (
      <article className="max-w-xl">
        {bar}
        <form action={savePlan}>
          <p className="section-label">My plan for 30 days</p>
          {draft ? (
            <>
              <label htmlFor="plan" className="sr-only">My plan</label>
              <textarea id="plan" name="plan" defaultValue={draft} maxLength={1500} rows={Math.max(4, Math.ceil(draft.length / 24) + 1)} className="textarea mt-3 !min-h-0 resize-none !bg-transparent !border-transparent hover:!border-line focus:!bg-surface font-serif !text-[24px] !leading-[1.35] text-heading" />
              <p className="mt-2 text-[15px] text-ink-soft">Built from your answers. Tap to change the wording until it sounds like you.</p>
              <span className="chip mt-2">{FIRST_GUESS}</span>
            </>
          ) : (
            <p className="mt-3 text-[15px] text-ink-soft">Answer when it happens and what you'll do instead first. <Link href="/cycle/setup?step=1" className="btn-link">Go to the first question</Link></p>
          )}
          <div className="mt-10 flex items-center justify-between">
            <Link href={back} className="text-[15px] btn-link">Back</Link>
            {draft && <Submit>Looks right</Submit>}
          </div>
        </form>
      </article>
    );
  }

  // Who finds out? At least one person from My people.
  const findsOut = people.filter((p) => (FINDS_OUT_ROLES as readonly string[]).includes(p.role));
  const mentees = people.filter((p) => (MENTEE_ROLES as readonly string[]).includes(p.role));
  return (
    <article className="max-w-xl">
      {bar}
      <p className="section-label">Discipline by Design</p>
      <h1 className="mt-2 font-serif text-[30px] leading-[1.15] tracking-[-0.01em] text-heading">{WHO_FINDS_OUT.title}</h1>
      {findsOut.length ? (
        <>
          <p className="mt-2 mb-5 text-[15px] text-ink-soft">{WHO_FINDS_OUT.hint}</p>
          <SetupShare people={findsOut} mentees={mentees} plan={cycle.plan} answers={cycle}
            initial={{ to: cycle.partnerId, feeling: cycle.shareFeeling, old: cycle.shareOld, gap: cycle.shareGap }} />
        </>
      ) : (
        <>
          <p className="mt-5 font-serif text-[21px] leading-snug text-heading">{WHO_FINDS_OUT.empty}</p>
          <p className="mt-3 text-[15px] text-ink-soft">{WHO_FINDS_OUT.emptyHint}</p>
          <form action={addFindsOutPerson} className="mt-6 space-y-3">
            <input name="name" required maxLength={120} placeholder="Name" aria-label="Name" className="input" />
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="sr-only">Role</legend>
              {FINDS_OUT_ROLES.map((r, i) => (
                <label key={r} className="cursor-pointer">
                  <input type="radio" name="role" value={r} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="option text-center !py-3 text-[15px]">{RELATIONSHIP_ROLES[r]}</span>
                </label>
              ))}
            </fieldset>
            <div className="pt-4 flex items-center justify-between">
              <Link href={back} className="text-[15px] btn-link">Back</Link>
              <Submit>Add and continue</Submit>
            </div>
          </form>
        </>
      )}
      {findsOut.length > 0 && <p className="mt-10"><Link href={back} className="text-[15px] btn-link">Back</Link></p>}
    </article>
  );
}
