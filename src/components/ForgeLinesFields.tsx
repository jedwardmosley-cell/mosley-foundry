import { FORGE_LINES, FORGE_LINES_STATUS, type LineField } from "@/content/forgeLines";
import type { PathwayKey } from "@/content/program";
import { PillarMark, Field } from "./ui";
import { PrefixedBox } from "./PrefixedBox";
import { Picks } from "./Picks";
import { HelpMeWrite } from "./HelpMeWrite";
import { CombineLines } from "./CombineLines";
import { IdentityCoach } from "./IdentityCoach";
import { exampleGroups, examplePlaceholder, IDENTITY_EXAMPLES_STATUS, IDENTITY_TESTS } from "@/content/identityExamples";

type Saved = Partial<Record<LineField | "forgeStatement", string>> | null | undefined;

/** The five FORGE identity statements and the FORGE statement. Used on the FORGE plan and in the guided first session. */
export function ForgeLinesFields({ profile, pathway, claim, ai, statementHint }: { profile: Saved; pathway: PathwayKey; claim: string; ai: boolean; statementHint: string }) {
  return (
    <>
      <details className="rounded-xl bg-paper px-3 py-2 text-sm">
        <summary className="cursor-pointer text-link">Is it an identity?</summary>
        <ol className="mt-2 list-decimal pl-5 space-y-1 text-ink-soft">{IDENTITY_TESTS.map((t) => <li key={t}>{t}</li>)}</ol>
        <p className="mt-2 text-ink-soft">The behaviors come next, in My road and your 30 days.</p>
      </details>
          {FORGE_LINES.map((l) => {
        const groups = [...(l.field === "destination" && claim ? [{ label: "Yours, from who I am", options: [claim] }] : []), ...exampleGroups(l.field, pathway)];
        return (
          <div key={l.field}>
            <label htmlFor={l.field} className="flex items-center gap-2.5 mb-2">
              <PillarMark k={l.pillar} />
              <span className="font-medium text-[15px] leading-snug">{l.question}<span className="sr-only"> ({l.label})</span></span>
            </label>
            <PrefixedBox name={l.field} prefix={l.prefix} saved={profile?.[l.field] ?? ""} placeholder={examplePlaceholder(l.field, pathway)} />
            <Picks list={{ status: IDENTITY_EXAMPLES_STATUS, options: [] }} groups={groups} target={l.field} folded="Examples" note={l.hint} />
            {ai && <IdentityCoach field={l.field} prefix={l.prefix} />}
          </div>
        );
      })}
      <div className="border-t border-line pt-5">
        <label htmlFor="forgeStatement" className="label">FORGE statement</label>
        {statementHint && (
          <details className="mb-2 text-sm">
            <summary className="cursor-pointer text-link">What to write</summary>
            <p className="mt-1 text-ink-soft">{statementHint}</p>
          </details>
        )}
        <textarea id="forgeStatement" name="forgeStatement" defaultValue={profile?.forgeStatement ?? ""} className="textarea min-h-[140px]" maxLength={3000} />
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          <CombineLines target="forgeStatement" />
          {ai && <HelpMeWrite kind="forgeStatement" target="forgeStatement" />}
        </div>
      </div>
    </>
  );
}
