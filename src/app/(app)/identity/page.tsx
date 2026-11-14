import { fiveLines } from "@/content/forgeLines";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveWhoIAm, removeIdentity, saveIdentityControls } from "@/app/actions/identity";
import { TONE_LABELS, type ToneSetting } from "@/lib/identityTone";
import { LEVELS, FIRST_EXAMPLE, PICKS_STATUS, SITUATION_PICKS, type IdentityLevel } from "@/content/identity";
import { ROLE_PICKS, WHO_I_AM_STATUS, WHO_TITLE, WHO_INTRO, WHO_HEADINGS, withArticle } from "@/content/whoIAm";
import { getForgeSource } from "@/content/forgeSource";
import { identityGaps } from "@/lib/journey";
import { FiveSides, MyStatement } from "@/components/ForgeLinesFields";
import { aiAvailable } from "@/lib/ai";
import { getContent } from "@/content";
import type { PathwayKey } from "@/content/program";
import { fmt } from "@/lib/dates";
import { PageHeader, Card } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { StatementReveal } from "@/components/StatementReveal";
import { Picks } from "@/components/Picks";
import { IdentitySpectrum } from "@/components/IdentitySpectrum";

export const metadata = { title: "Who's behind the wheel" };

export default async function IdentityPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { saved } = await searchParams;
  const [profile, id, history] = await Promise.all([
    db.profile.findUnique({ where: { userId: u.id } }),
    db.identityProfile.findUnique({ where: { userId: u.id } }),
    db.identityHistory.findMany({ where: { userId: u.id }, orderBy: { endedAt: "desc" }, take: 10 }),
  ]);
  const pathway = (profile?.pathway ?? "PERSONAL") as PathwayKey;
  const role = id?.role ?? "";
  const level = id?.level ?? "";
  // My statement: the profile's statement, or the older I am claim when that is all there is.
  const statement = profile?.forgeStatement || id?.becoming || "";
  const earlier = profile?.forgeStatement && id?.becoming && id.becoming !== profile.forgeStatement ? id.becoming : "";
  const ai = aiAvailable() && profile?.aiEnabled !== false;
  const { pack, entrepreneur } = await getContent();
  const forge = await getForgeSource();
  const gaps = identityGaps(id, profile?.forgeStatement ?? "");
  const rules = Object.fromEntries(pack.pillars.map((p) => [p.key, p.short]));
  const hint = profile?.pathway === "ENTREPRENEURIAL" && entrepreneur ? entrepreneur.forgeStatementPrompt : pack.forgeStatementPrompt;

  return (
    <>
      <PageHeader eyebrow="FORGE" title={WHO_TITLE}>{WHO_INTRO}</PageHeader>

      {/* Say exactly what keeps this step open, with a link to each part. */}
      {!saved && gaps.length > 0 && (id || profile?.forgeStatement || profile?.destination) && (
        <p className="mb-4 rounded-2xl bg-gold-soft px-4 py-3 text-sm text-ink">
          Still open:{" "}
          {gaps.map((g, i) => (
            <span key={g}>{i > 0 && ", "}<a href={g === "your seat" ? "#role" : g === "how big a turn" ? "#kind" : "#statement"} className="btn-link">{g}</a></span>
          ))}
          . This step is done when all three are saved.
        </p>
      )}
      {saved && <p role="status" className="mb-4 notice">Saved. Next, <Link href="/assessment" className="btn-link">see where you are today</Link>.</p>}

      <form action={saveWhoIAm} className="space-y-5">
        <Card>
          <label htmlFor="role" className="section-title"><span className="step-n">1</span>{WHO_HEADINGS.role}</label>
          <div className="flex items-center inputbox">
            <span className="pl-3.5 pr-1.5 py-2.5 text-[15px] text-ink-soft whitespace-nowrap select-none">This is about me as</span>
            <input id="role" name="role" defaultValue={role} maxLength={80} placeholder={withArticle(ROLE_PICKS[pathway][0])} className="flex-1 min-w-0 bg-transparent py-2.5 pr-3 text-[15px] focus:outline-none" />
          </div>
          <Picks list={{ status: WHO_I_AM_STATUS, options: ROLE_PICKS[pathway] }} target="role" label="Tap one, or write your own. One role for each 30 days." />
          <details className="mt-4" open={!!id?.situation}>
            <summary className="cursor-pointer text-sm text-link">What situation or chapter of life makes this change important? <span className="text-ink-mute">(optional)</span></summary>
            <input name="situation" aria-label="Situation" defaultValue={id?.situation} maxLength={1500} className="input mt-2" />
            <Picks list={{ status: PICKS_STATUS, options: SITUATION_PICKS[pathway] }} target="situation" folded="Examples" />
          </details>
        </Card>

        <Card>
          <p id="kind" className="section-title scroll-mt-24"><span className="step-n">2</span>{WHO_HEADINGS.kind}</p>
          <IdentitySpectrum
            initial={id?.level as IdentityLevel | undefined}
            firstExample={FIRST_EXAMPLE[pathway]}
            persona={{ personaName: id?.personaName, personaQualities: id?.personaQualities, personaStandards: id?.personaStandards, personaSituations: id?.personaSituations, personaCue: id?.personaCue, personaBehaviors: id?.personaBehaviors }}
          />
        </Card>

        <Card className="scroll-mt-20" id="forge">
          <p className="section-title"><span className="step-n">3</span>{WHO_HEADINGS.forge}</p>
          <FiveSides profile={profile} pathway={pathway} role={role} level={level} ai={ai} teach={forge?.cards ?? {}} rules={rules} opening={forge?.intro} guide={forge?.guide?.rules ?? {}} />
        </Card>

        <Card>
          <MyStatement n={4} statement={statement} earlier={earlier} ai={ai} hint={hint} saved={profile} />
        </Card>

        <StatementReveal saved={fiveLines(profile)} />
      </form>

      {id && (
        <details className="card mt-6">
          <summary className="cursor-pointer h3">AI companion and sharing</summary>
          <form action={saveIdentityControls} className="mt-4 space-y-5">
            <fieldset>
              <legend className="label">Coaching tone in the AI companion</legend>
                            <div className="space-y-1.5">
                {(Object.entries(TONE_LABELS) as [ToneSetting, string][]).map(([v, label]) => (
                  <label key={v} className="flex items-start gap-2 text-[15px]">
                    <input type="radio" name="tone" value={v} defaultChecked={id.tone === v} className="mt-1 accent-navy" />
                    <span>{label}{v === "AUTO" && <span className="block text-ink-mute text-sm">Right now: {TONE_LABELS[({ CORE: "SUPPORTIVE", ROLE: "DIRECT", REINVENT: "DEMANDING" } as const)[id.level as IdentityLevel]].toLowerCase()}</span>}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="label">What the AI companion can use</legend>
              <label className="flex items-start gap-2 text-[15px]">
                <input type="checkbox" name="aiUse" defaultChecked={id.aiUse} className="mt-1 h-4 w-4 accent-navy" />
                <span>Use my level, my statement and my behavior. <span className="text-ink-mute text-sm">They are sent to Anthropic, the AI provider, when you chat.</span></span>
              </label>
              {id.level === "REINVENT" && (
                <label className="flex items-start gap-2 text-[15px]">
                  <input type="checkbox" name="aiUsePersona" defaultChecked={id.aiUsePersona} className="mt-1 h-4 w-4 accent-navy" />
                  <span>Also use my performance identity: its name, standards and activation cue.</span>
                </label>
              )}
            </fieldset>
            <fieldset>
              <legend className="label">What my coach can see</legend>
              <p className="text-sm text-ink-soft">Only if you turn on <Link href="/sharing" className="btn-link">Who's behind the wheel in Sharing</Link>. Check-in notes stay private.</p>
              {id.level === "REINVENT" && (
                <label className="mt-2 flex items-start gap-2 text-[15px]">
                  <input type="checkbox" name="sharePersona" defaultChecked={id.sharePersona} className="mt-1 h-4 w-4 accent-navy" />
                  <span>When Who's behind the wheel is shared, include my performance identity too.</span>
                </label>
              )}
            </fieldset>
            <Submit className="btn-quiet">Save these settings</Submit>
          </form>
        </details>
      )}

      {history.length > 0 && (
        <Card className="mt-6">
          <p className="eyebrow">Earlier versions</p>
          <ul className="mt-2 divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="py-2.5">
                <p className="text-xs text-ink-mute">{fmt(h.startedAt, { month: "short", day: "numeric", year: "numeric" })} to {fmt(h.endedAt, { month: "short", day: "numeric", year: "numeric" })} · {LEVELS[h.level as IdentityLevel]?.name}{h.personaName ? ` · ${h.personaName}` : ""}</p>
                <p className="text-[15px]">{h.becoming}</p>
                {h.behavior && <p className="text-sm text-ink-soft">Behavior: {h.behavior}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {id && (
        <form action={removeIdentity} className="mt-6">
          <button className="text-sm text-ink-mute hover:text-ink">Clear who I am (earlier versions are kept)</button>
        </form>
      )}
    </>
  );
}
