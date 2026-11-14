import { FORGE_LINES, combineLines, type LineField } from "@/content/forgeLines";
import type { PathwayKey } from "@/content/program";
import Link from "next/link";
import type { CSSProperties } from "react";
import { asRole, FORGE_OPENING } from "@/content/whoIAm";
import type { ForgeCard } from "@/content/forgeParse";
import type { PillarKey } from "@/content/types";
import { PillarMark, PILLAR_FILL } from "./ui";
import { PrefixedBox } from "./PrefixedBox";
import { Picks } from "./Picks";
import { HelpMeWrite } from "./HelpMeWrite";
import { IdentityCoach } from "./IdentityCoach";
import { GuideText } from "./GuideText";
import { exampleGroups, IDENTITY_EXAMPLES_STATUS, IDENTITY_TESTS } from "@/content/identityExamples";

type Saved = Partial<Record<LineField, string>> | null | undefined;
type Teach = Partial<Record<PillarKey, Partial<ForgeCard>>>;

/**
 * The five parts of one driver: FORGE, applied to the client's role. Each letter shows its name,
 * the book's rule line and the part of identity it shapes. "What this means" opens the teaching
 * from forge-source.md. Then the question, the I am line and one example.
 */
export function FiveSides({ profile, pathway, role, level, ai, teach = {}, rules = {}, opening, guide = {} }: {
  profile: Saved; pathway: PathwayKey; role: string; level: string; ai: boolean; teach?: Teach; rules?: Partial<Record<PillarKey, string>>;
  /** The author's Core idea and forge passage, from forge-source.md. */
  opening?: { line: string; core: string; forge: string };
  /** The author's teaching guide, per rule. When present, it is What this means. */
  guide?: Partial<Record<PillarKey, { md: string }>>;
}) {
  return (
    <div className="space-y-2">
      <div className="pb-4">
        <p className="font-serif text-[22px] sm:text-[24px] leading-snug text-heading">{opening?.line || FORGE_OPENING.line}</p>
        {opening?.core && <p className="mt-3 text-[16px] leading-relaxed text-ink">{opening.core}</p>}
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{FORGE_OPENING.text}</p>
        {opening?.forge && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-link font-medium">Why it&apos;s called FORGE</summary>
            <p className="mt-2 font-serif text-[17px] leading-[1.55] text-heading">{opening.forge}</p>
          </details>
        )}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-link font-medium">Is it an identity?</summary>
          <ol className="mt-2 list-decimal pl-5 space-y-1 text-ink-soft">{IDENTITY_TESTS.map((t) => <li key={t}>{t}</li>)}</ol>
          <p className="mt-2 text-ink-soft">The behaviors come next, in My road and your 30 days.</p>
        </details>
      </div>
      {FORGE_LINES.map((l) => {
        const t = teach[l.pillar];
        const rule = t?.rule || rules[l.pillar] || "";
        const tone = { "--pc": `var(${PILLAR_FILL[l.pillar].cssVar})` } as CSSProperties;
        return (
          <section key={l.field} id={l.pillar.toLowerCase()} style={tone} className="scroll-mt-24 border-t border-line/60 pt-6 pb-2">
            <header className="flex items-start gap-3.5">
              <PillarMark k={l.pillar} />
              <div className="min-w-0">
                <h3 className="font-serif text-[22px] leading-tight text-heading">{l.label}</h3>
                {rule && <p className="mt-0.5 font-serif text-[17px] italic" style={{ color: "rgb(var(--pc))" }}>{rule}</p>}
                <p className="mt-1.5 text-sm text-ink-soft">{l.shapes}</p>
              </div>
            </header>

            {(t?.means || guide[l.pillar]) && (
              <details className="mt-4 rounded-2xl px-4 py-3" style={{ background: "rgb(var(--pc) / 0.06)" }}>
                <summary className="cursor-pointer text-[15px] font-medium text-link">What this means</summary>
                <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-ink">
                  {guide[l.pillar] ? <GuideText md={guide[l.pillar]!.md} className="!text-[15px]" /> : <p>{t?.means}</p>}
                  {t?.road && !guide[l.pillar] && (
                    <div>
                      <p className="section-label">From the road</p>
                      <p className="mt-1.5 font-serif text-[17px] leading-[1.5] text-heading">{t.road}</p>
                      {t.roadMore && <p className="mt-2 font-serif text-[17px] leading-[1.5] text-heading">{t.roadMore}</p>}
                    </div>
                  )}
                  {t?.why && (
                    <div>
                      <p className="section-label">Why it works</p>
                      <p className="mt-1.5">{t.why}</p>
                    </div>
                  )}
                  {t?.connects && <p className="text-ink-soft">{t.connects}</p>}
                  {!!t?.before?.length && (
                    <div>
                      <p className="section-label">Before you write</p>
                      {t.beforeIntro && <p className="mt-1.5">{t.beforeIntro}</p>}
                      <ul className="mt-2 space-y-1.5">
                        {t.before.map((q) => <li key={q} className="flex gap-2.5"><span aria-hidden className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "rgb(var(--pc))" }} />{q}</li>)}
                      </ul>
                    </div>
                  )}
                  <Link href={`/forge/${l.pillar.toLowerCase()}/guide`} className="inline-block text-sm btn-link">Read the full guide</Link>
                </div>
              </details>
            )}

            <label htmlFor={l.field} className="mt-5 mb-2 block text-[15px] font-medium text-heading">{asRole(l.question, role)}<span className="sr-only"> ({l.label})</span></label>
            <PrefixedBox name={l.field} prefix={l.prefix} saved={profile?.[l.field] ?? ""} placeholder="" />
            <div className="relative">
              <Picks list={{ status: IDENTITY_EXAMPLES_STATUS, options: [] }} groups={exampleGroups(l.field, pathway, role, level)} target={l.field} folded="Examples" note={l.hint} alignRight={ai} />
              {ai && <IdentityCoach field={l.field} prefix={l.prefix} corner />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** My statement: the single identity statement, built from the five. This is what Today shows. */
export function MyStatement({ statement, earlier, ai, hint, saved, n }: { statement: string; earlier?: string; ai: boolean; hint?: string; saved?: Saved; n?: number }) {
  return (
    <div>
      <label htmlFor="statement" className={n ? "section-title" : "label"}>{n ? <span className="step-n">{n}</span> : null}My statement</label>
      <p className="text-sm text-ink-soft mb-2">Your five lines, said as one. Start with I am. This is what you see each day.</p>
      {earlier && (
        <p className="mb-2 rounded-2xl bg-field px-4 py-3 text-sm text-ink-soft">Earlier I am statement: <span className="text-ink">{earlier}</span></p>
      )}
      {hint && (
        <details className="mb-2 text-sm">
          <summary className="cursor-pointer text-link">What to write</summary>
          <p className="mt-1 text-ink-soft">{hint}</p>
        </details>
      )}
      {/* Starts from the five lines when there is no statement yet. Nothing is saved until the client saves. */}
      <textarea id="statement" name="statement" defaultValue={statement || combineLines(saved ?? {})} className="textarea min-h-[120px]" maxLength={3000} />
      {ai && <div className="mt-2"><HelpMeWrite kind="forgeStatement" target="statement" /></div>}
    </div>
  );
}
