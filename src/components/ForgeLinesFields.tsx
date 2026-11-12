import { FORGE_LINES, FORGE_LINES_STATUS, type LineField } from "@/content/forgeLines";
import type { PathwayKey } from "@/content/program";
import { PillarMark, Field } from "./ui";
import { PrefixedBox } from "./PrefixedBox";
import { Picks } from "./Picks";
import { HelpMeWrite } from "./HelpMeWrite";
import { CombineLines } from "./CombineLines";
import { IdentityCoach } from "./IdentityCoach";

type Saved = Partial<Record<LineField | "forgeStatement", string>> | null | undefined;

/** The five FORGE identity statements and the FORGE Statement. Used on the FORGE Plan and in the guided first session. */
export function ForgeLinesFields({ profile, pathway, claim, ai, statementHint }: { profile: Saved; pathway: PathwayKey; claim: string; ai: boolean; statementHint: string }) {
  return (
    <>
          {FORGE_LINES.map((l) => {
        const starters = l.field === "destination" && claim ? [claim, ...l.starters[pathway]] : l.starters[pathway];
        return (
          <div key={l.field}>
            <label htmlFor={l.field} className="flex items-center gap-2.5">
              <PillarMark k={l.pillar} />
              <span><span className="label !mb-0 block">{l.label}</span><span className="text-sm text-ink-soft">{l.question}</span></span>
            </label>
            <p className="text-xs text-ink-mute mt-2 mb-1.5">{l.hint}</p>
            <PrefixedBox name={l.field} prefix={l.prefix} saved={profile?.[l.field] ?? ""} placeholder={l.placeholder} />
            <Picks list={{ status: FORGE_LINES_STATUS, options: starters }} target={l.field} label="Examples to start from. Make it yours." />
            {ai && <IdentityCoach field={l.field} prefix={l.prefix} />}
          </div>
        );
      })}
      <div className="border-t border-line pt-5">
        <Field label="FORGE Statement" hint={statementHint}>
          <textarea name="forgeStatement" defaultValue={profile?.forgeStatement ?? ""} className="textarea min-h-[140px]" maxLength={3000} />
        </Field>
        <p className="text-xs text-ink-mute mt-1 mb-2">Your five identity statements in one paragraph. It describes who you are. Read it out loud at the start of each week.</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <CombineLines target="forgeStatement" />
          {ai && <HelpMeWrite kind="forgeStatement" target="forgeStatement" />}
        </div>
      </div>
    </>
  );
}
