import { FORGE_LINES, type LineField } from "@/content/forgeLines";
import type { PathwayKey } from "@/content/program";
import { asRole } from "@/content/whoIAm";
import { PillarMark } from "./ui";
import { PrefixedBox } from "./PrefixedBox";
import { Picks } from "./Picks";
import { HelpMeWrite } from "./HelpMeWrite";
import { CombineLines } from "./CombineLines";
import { IdentityCoach } from "./IdentityCoach";
import { exampleGroups, examplePlaceholder, IDENTITY_EXAMPLES_STATUS, IDENTITY_TESTS } from "@/content/identityExamples";

type Saved = Partial<Record<LineField, string>> | null | undefined;

/**
 * F, O, R, G, E: one identity seen from five sides. Each question carries the role
 * ("As a manager, who am I becoming?"), and the examples match the role and the kind of change.
 */
export function FiveSides({ profile, pathway, role, level, ai }: { profile: Saved; pathway: PathwayKey; role: string; level: string; ai: boolean }) {
  return (
    <>
      <details className="rounded-xl bg-paper px-3 py-2 text-sm">
        <summary className="cursor-pointer text-link">Is it an identity?</summary>
        <ol className="mt-2 list-decimal pl-5 space-y-1 text-ink-soft">{IDENTITY_TESTS.map((t) => <li key={t}>{t}</li>)}</ol>
        <p className="mt-2 text-ink-soft">The behaviors come next, in My road and your 30 days.</p>
      </details>
      {FORGE_LINES.map((l) => (
        <div key={l.field}>
          <label htmlFor={l.field} className="flex items-center gap-2.5 mb-2">
            <PillarMark k={l.pillar} />
            <span className="font-medium text-[15px] leading-snug">{asRole(l.question, role)}<span className="sr-only"> ({l.label})</span></span>
          </label>
          <PrefixedBox name={l.field} prefix={l.prefix} saved={profile?.[l.field] ?? ""} placeholder={examplePlaceholder(l.field, pathway, role, level)} />
          {/* Examples on the left, Help me find this on the right, on one line. Either opens full width below. */}
          <div className="relative">
            <Picks list={{ status: IDENTITY_EXAMPLES_STATUS, options: [] }} groups={exampleGroups(l.field, pathway, role, level)} target={l.field} folded="Examples" note={l.hint} />
            {ai && <IdentityCoach field={l.field} prefix={l.prefix} corner />}
          </div>
        </div>
      ))}
    </>
  );
}

/** My statement: the single identity statement, built from the five. This is what Today shows. */
export function MyStatement({ statement, earlier, ai, hint, saved, n }: { statement: string; earlier?: string; ai: boolean; hint?: string; saved?: Saved; n?: number }) {
  return (
    <div>
      <label htmlFor="statement" className="label">{n ? `${n}. ` : ""}My statement</label>
      <p className="text-sm text-ink-soft mb-2">Your five lines, said as one. Start with I am. This is what you see each day.</p>
      {earlier && (
        <p className="mb-2 rounded-xl bg-paper px-3 py-2 text-sm text-ink-soft">Earlier I am statement: <span className="text-ink">{earlier}</span></p>
      )}
      {hint && (
        <details className="mb-2 text-sm">
          <summary className="cursor-pointer text-link">What to write</summary>
          <p className="mt-1 text-ink-soft">{hint}</p>
        </details>
      )}
      <textarea id="statement" name="statement" defaultValue={statement} className="textarea min-h-[120px]" maxLength={3000} />
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
        <CombineLines target="statement" saved={saved ?? {}} />
        {ai && <HelpMeWrite kind="forgeStatement" target="statement" />}
      </div>
    </div>
  );
}
