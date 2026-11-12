import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { aiAvailable } from "@/lib/ai";
import { saveStatement } from "@/app/actions/participant";
import { PageHeader, Card, Source } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { DictationHint } from "@/components/Picks";
import Link from "next/link";
import { LEVELS, type IdentityLevel } from "@/content/identity";
import { FORGE_LINES_STATUS } from "@/content/forgeLines";
import { FORGE_IDENTITY_TITLE, FORGE_IDENTITY_INTRO } from "@/content/forgeIdentityIntro";
import { ForgeLinesFields } from "@/components/ForgeLinesFields";
import type { PathwayKey } from "@/content/program";

export const metadata = { title: "FORGE Plan" };

export default async function PlanPage() {
  const u = await requireUser("PARTICIPANT");
  const { pack, entrepreneur } = await getContent();
  const profile = await db.profile.findUnique({ where: { userId: u.id } });
  const identity = await db.identityProfile.findUnique({ where: { userId: u.id }, select: { level: true, becoming: true } });
  const entre = profile?.pathway === "ENTREPRENEURIAL" && entrepreneur;
  const ai = aiAvailable() && profile?.aiEnabled !== false;
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
          <p className="text-sm muted mt-1">Write your I am statement and choose how big a change it is. Your FORGE identity builds on it.</p>
        </Link>
      )}

      <Card className="mt-5">
        <form action={saveStatement} className="space-y-6">
          <div>
            <h2 className="h3">{FORGE_IDENTITY_TITLE}</h2>
            <p className="text-sm muted mt-1">{FORGE_IDENTITY_INTRO}</p>
            <p className="text-xs text-ink-mute mt-2">Habits and routines come next, in your <Link href="/blueprint" className="btn-link">Blueprint</Link>. That is where this identity turns into practice.</p>
            {FORGE_LINES_STATUS === "draft" && <span className="draft !text-[10px] mt-2 inline-block">Draft wording</span>}
          </div>
          <ForgeLinesFields profile={profile} pathway={pathway} claim={claim} ai={ai} statementHint={entre ? entrepreneur.forgeStatementPrompt : pack.forgeStatementPrompt} />
          <DictationHint />
          {pack.holdYourself && <p className="quote text-[15px]">{pack.holdYourself}</p>}
          <Submit>Save my FORGE identity</Submit>
        </form>
        <Source>FORGE pillars, questions and instruction: Jason Mosley. Hints and examples: build team draft. FORGE Statement: Personal Application Workbook, Section Six</Source>
      </Card>

      <Link href="/blueprint#one-move" className="card block mt-5 hover:border-navy/40">
        <p className="eyebrow">Next: Discipline by Design</p>
        <h2 className="h3 mt-1">Turn your identity into practice</h2>
        <p className="text-sm muted mt-1">Your one move each week, your routines and your people are in your Blueprint.</p>
      </Link>
    </>
  );
}
