import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { ONE_MOVE } from "@/content/options";
import { aiAvailable } from "@/lib/ai";
import { saveGoal, saveStatement } from "@/app/actions/participant";
import { PageHeader, Card, PillarMark, Source, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { Picks, DictationHint } from "@/components/Picks";
import { HelpMeWrite } from "@/components/HelpMeWrite";
import Link from "next/link";
import { LEVELS, PILLAR_PROMPTS, PILLAR_PROMPTS_STATUS, type IdentityLevel } from "@/content/identity";
import { FORGE_LINES_STATUS } from "@/content/forgeLines";
import { ForgeLinesFields } from "@/components/ForgeLinesFields";
import type { PathwayKey } from "@/content/program";

export const metadata = { title: "FORGE Plan" };

export default async function PlanPage() {
  const u = await requireUser("PARTICIPANT");
  const { pack, entrepreneur } = await getContent();
  const [profile, goals] = await Promise.all([
    db.profile.findUnique({ where: { userId: u.id } }),
    db.developmentGoal.findMany({ where: { userId: u.id, status: "ACTIVE", segmentKey: null } }),
  ]);
  const identity = await db.identityProfile.findUnique({ where: { userId: u.id }, select: { level: true, becoming: true } });
  const entre = profile?.pathway === "ENTREPRENEURIAL" && entrepreneur;
  const roadTest = pack.chapters.find((c) => c.number === 9)?.roadTest ?? [];
  const rt = (k: string) => roadTest.find((l) => l.startsWith(`${k}:`))?.slice(3);
  const ai = aiAvailable() && profile?.aiEnabled !== false;
  const priority = profile?.priorityPillar;
  const pathway = (profile?.pathway ?? "PERSONAL") as PathwayKey;
  const claim = identity?.becoming.replace(/^(i am|i'm)\s+/i, "") ?? "";

  return (
    <>
      <PageHeader eyebrow="Section Six" title="Your FORGE Action Plan">{pack.actionPlanIntro}</PageHeader>

      {identity ? (
        <Link href="/identity" className="card block hover:border-navy/40">
          <div className="flex items-baseline justify-between gap-3">
            <p className="eyebrow">Who I am</p>
            <span className="chip">Level {LEVELS[identity.level as IdentityLevel].n} · {LEVELS[identity.level as IdentityLevel].name}</span>
          </div>
          <p className="mt-2 font-serif text-lg leading-relaxed">{identity.becoming}</p>
          <p className="mt-1 text-xs text-ink-mute">Tap to change it in Identity Shift.</p>
        </Link>
      ) : (
        <Link href="/identity" className="card block border-navy/40 ring-1 ring-navy/10 hover:border-navy">
          <p className="eyebrow">Start here</p>
          <h2 className="h3 mt-1">Claim who you are</h2>
          <p className="text-sm muted mt-1">Write your I am statement and choose how big a change it is. Your five FORGE lines build on it.</p>
        </Link>
      )}

      <Card className="mt-5">
        <form action={saveStatement} className="space-y-6">
          <div>
            <h2 className="h3">Your five FORGE lines</h2>
            <p className="text-sm muted mt-1">I am, plus what I do. One line for each letter, all in the present tense. Tap a starter, then make it yours.</p>
            {FORGE_LINES_STATUS === "draft" && <span className="draft !text-[10px] mt-2 inline-block">Draft wording</span>}
          </div>
          <ForgeLinesFields profile={profile} pathway={pathway} claim={claim} ai={ai} statementHint={entre ? entrepreneur.forgeStatementPrompt : pack.forgeStatementPrompt} />
          <DictationHint />
          {pack.holdYourself && <p className="quote text-[15px]">{pack.holdYourself}</p>}
          <Submit>Save my FORGE lines</Submit>
        </form>
        <Source>FORGE pillars: Both Hands on the Wheel. Line wording and starters: build team draft. FORGE Statement: Personal Application Workbook, Section Six</Source>
      </Card>

      <p className="mt-6 mb-3 text-sm muted">
        {priority ? "Start with your priority. Open the others when you are ready; one pillar with real attention beats five with divided attention." : "Choose a development priority from your assessment results to focus this plan."}
      </p>
      <div className="space-y-3">
        {[...pack.pillars].sort((a, b) => Number(b.key === priority) - Number(a.key === priority)).map((p) => {
          const g = goals.find((x) => x.pillar === p.key);
          const isPriority = priority === p.key;
          const filled = !!(g?.whereNow || g?.whereWant || g?.oneMove);
          return (
            <details key={p.key} open={isPriority || (!priority && p.key === "F")} className={`card group ${isPriority ? "border-navy/40 ring-1 ring-navy/10" : ""}`}>
              <summary className="cursor-pointer list-none flex items-center gap-3">
                <PillarMark k={p.key} />
                <div className="flex-1">
                  <h2 className="h3">{p.name}</h2>
                  <p className="text-sm muted">{g?.oneMove ? `One move: ${g.oneMove}` : p.short}</p>
                </div>
                {isPriority ? <span className="chip !border-navy/30 !text-navy">Priority</span> : filled ? <span className="chip">Started</span> : null}
                <span aria-hidden className="text-ink-mute group-open:rotate-90 transition-transform">›</span>
              </summary>
              <form action={saveGoal} className="mt-5 space-y-4">
                <input type="hidden" name="pillar" value={p.key} />
                <Field label="One move this week">
                  <input name="oneMove" defaultValue={g?.oneMove} className="input" maxLength={1000} />
                </Field>
                <Picks list={ONE_MOVE[p.key]} target="oneMove" />
                {identity && (
                  <p className="rounded-xl bg-paper p-3 text-sm">
                    <span className="font-medium">For {LEVELS[identity.level as IdentityLevel].name}: </span>
                    {PILLAR_PROMPTS[p.key][identity.level as IdentityLevel]}
                    {PILLAR_PROMPTS_STATUS === "draft" && <span className="ml-2 draft !text-[10px]">Draft</span>}
                  </p>
                )}
                <details open={!!(g?.whereNow || g?.whereWant)}>
                  <summary className="cursor-pointer text-sm text-navy">Where I am now and where I want to be <span className="text-ink-mute">(optional)</span></summary>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Where I am now"><textarea name="whereNow" defaultValue={g?.whereNow} className="textarea !min-h-[80px]" maxLength={1500} /></Field>
                    <Field label="Where I want to be"><textarea name="whereWant" defaultValue={g?.whereWant} className="textarea !min-h-[80px]" maxLength={1500} /></Field>
                  </div>
                </details>
                {rt(p.key) && <p className="text-sm text-ink-soft"><span className="font-medium">Road Test. </span>{rt(p.key)}</p>}
                <Submit className="btn-quiet">Save {p.key}</Submit>
              </form>
            </details>
          );
        })}
      </div>
    </>
  );
}
