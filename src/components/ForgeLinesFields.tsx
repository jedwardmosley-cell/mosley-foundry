import { FORGE_LINES, FORGE_LINES_STATUS, type LineField } from "@/content/forgeLines";
import type { PathwayKey } from "@/content/program";
import { PillarMark, Field } from "./ui";
import { PrefixedBox } from "./PrefixedBox";
import { Picks } from "./Picks";
import { HelpMeWrite } from "./HelpMeWrite";
import { CombineLines } from "./CombineLines";
import { IdentityCoach } from "./IdentityCoach";

type Saved = Partial<Record<LineField | "forgeStatement", string>> | null | undefined;

/** The five FORGE identity statements and the FORGE statement. Used on the FORGE plan and in the guided first session. */
export function ForgeLinesFields({ profile, pathway, claim, ai, statementHint }: { profile: Saved; pathway: PathwayKey; claim: string; ai: boolean; statementHint: string }) {
  return (
    <>
          {FORGE_LINES.map((l) => {
        const starters = l.field === "destination" && claim ? [claim, ...l.starters[pathway]] : l.starters[pathway];
        return (
          <div key={l.field}>
            <label htmlFor={l.field} className="flex items-center gap-2.5 mb-2">
              <PillarMark k={l.pillar} />
              <span className="font-medium text-[15px] leading-snug">{l.question}<span className="sr-only"> ({l.label})</span></span>
            </label>
            <PrefixedBox name={l.field} prefix={l.prefix} saved={profile?.[l.field] ?? ""} placeholder={l.placeholder} />
            <Picks list={{ status: FORGE_LINES_STATUS, options: starters }} target={l.field} folded="Examples" note={l.hint} />
            {ai && <IdentityCoach field={l.field} prefix={l.prefix} />}
          </div>
        );
      })}
      <div className="border-t border-line pt-5">
        <label htmlFor="forgeStatement" className="label">FORGE statement</label>
        {statementHint && (
          <details className="mb-2 text-sm">
            <summary className="cursor-pointer text-navy">What to write</summary>
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
