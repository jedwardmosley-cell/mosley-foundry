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
        {/* All the reading about FORGE sits behind one fold, so the five letters come first. */}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-link font-medium">About FORGE</summary>
          <div className="mt-3 space-y-4">
            {FORGE_OPENING.about.map((t, i) => <p key={i} className={i === 0 ? "text-[16px] leading-relaxed text-ink" : "text-[15px] leading-relaxed text-ink-soft"}>{t}</p>)}
            <div>
              <p className="section-label">Why it&apos;s called FORGE</p>
              <p className="mt-1 font-book text-[17px] leading-[1.55] text-heading">{FORGE_OPENING.why}</p>
            </div>
            <div>
              <p className="section-label">Is it an identity?</p>
              <p className="mt-1 text-ink-soft">{FORGE_OPENING.checksIntro}</p>
              <ul className="mt-1 list-disc pl-5 space-y-1 text-ink-soft">{IDENTITY_TESTS.map((t) => <li key={t}>{t}</li>)}</ul>
              <p className="mt-2 text-ink-soft">{FORGE_OPENING.checksExample}</p>
              <p className="mt-2 text-ink-soft">{FORGE_OPENING.next}</p>
            </div>
          </div>
        </details>
      </div>
      {FORGE_LINES.map((l) => {
        const t = teach[l.pillar];
        const rule = t?.rule || rules[l.pillar] || "";
        const tone = { "--pc": `var(${PILLAR_FILL[l.pillar].cssVar})` } as CSSProperties;
        const written = (profile?.[l.field] ?? "").trim();
        // Each letter folds on its own. Open while it's still empty; once written it folds, showing its line. Tap to work on it again.
        return (
          <details key={l.field} id={l.pillar.toLowerCase()} style={tone} open={!written} className="group/letter scroll-mt-24 border-t border-line/60 py-4">
            <summary className="flex cursor-pointer list-none items-start gap-3.5">
              <PillarMark k={l.pillar} />
              <span className="min-w-0 flex-1">
                <span className="block font-book text-[21px] leading-tight text-heading">{l.label}</span>
                {rule && <span className="mt-0.5 block font-book text-[16px] italic" style={{ color: "rgb(var(--pc))" }}>{rule}</span>}
                <span className="mt-1 text-[14px] text-ink-soft line-clamp-2 group-open/letter:hidden">{written || "Not written yet"}</span>
              </span>
              <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rotate-45 border-b-[1.6px] border-r-[1.6px] border-ink-mute transition group-open/letter:-rotate-[135deg] group-open/letter:mt-3" />
            </summary>
            <div className="pt-3">
            <p className="text-sm text-ink-soft">{l.shapes}</p>

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
            </div>
          </details>
        );
      })}
    </div>
  );
}

/** My statement: the single identity statement, built from the five. This is what the Dashboard shows. */
export function MyStatement({ statement, earlier, ai, hint, saved, n, bare = false }: { statement: string; earlier?: string; ai: boolean; hint?: string; saved?: Saved; n?: number; /** Inside a fold that already says "My statement". */ bare?: boolean }) {
  return (
    <div>
      <label htmlFor="statement" className={bare ? "sr-only" : n ? "section-title" : "label"}>{n ? <span className="step-n">{n}</span> : null}My statement</label>
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
