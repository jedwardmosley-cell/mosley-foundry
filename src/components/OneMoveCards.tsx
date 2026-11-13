import type { ContentPack } from "@/content/types";
import { ONE_MOVE } from "@/content/options";
import { saveGoal } from "@/app/actions/participant";
import { PillarMark, Field } from "./ui";
import { Submit } from "./Submit";
import { Picks } from "./Picks";
import { LEVELS, PILLAR_PROMPTS, PILLAR_PROMPTS_STATUS, type IdentityLevel } from "@/content/identity";

type Goal = { pillar: string; whereNow: string; whereWant: string; oneMove: string };

/** One move this week, per pillar. Behavior lives in Discipline by Design, so this sits in the blueprint. */
export function OneMoveCards({ pack, goals, priority, level }: { pack: ContentPack; goals: Goal[]; priority?: string | null; level?: string | null }) {
  const roadTest = pack.chapters.find((c) => c.number === 9)?.roadTest ?? [];
  const rt = (k: string) => roadTest.find((l) => l.startsWith(`${k}:`))?.slice(3);
  const one = (p: ContentPack["pillars"][number]) => {
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
                {isPriority ? <span className="chip !border-navy/30 !text-link">Priority</span> : filled ? <span className="chip">Started</span> : null}
                <span aria-hidden className="text-ink-mute group-open:rotate-90 transition-transform">›</span>
              </summary>
              <form action={saveGoal} className="mt-5 space-y-4">
                <input type="hidden" name="pillar" value={p.key} />
                <Field label="My move">
                  <input name="oneMove" defaultValue={g?.oneMove} className="input" maxLength={1000} />
                </Field>
                <Picks list={ONE_MOVE[p.key]} target="oneMove" folded="Ideas" />
                {level && (
                  <p className="rounded-xl bg-paper p-3 text-sm">
                    <span className="font-medium">For {LEVELS[level as IdentityLevel].name}: </span>
                    {PILLAR_PROMPTS[p.key][level as IdentityLevel]}
                    {PILLAR_PROMPTS_STATUS === "draft" && <span className="ml-2 draft !text-[10px]">Draft</span>}
                  </p>
                )}
                <details open={!!(g?.whereNow || g?.whereWant)}>
                  <summary className="cursor-pointer text-sm text-link">Where I am now and where I want to be</summary>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Where I am now"><textarea name="whereNow" defaultValue={g?.whereNow} className="textarea !min-h-[80px]" maxLength={1500} /></Field>
                    <Field label="Where I want to be"><textarea name="whereWant" defaultValue={g?.whereWant} className="textarea !min-h-[80px]" maxLength={1500} /></Field>
                  </div>
                </details>
                {rt(p.key) && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-link">Road test from the book</summary>
                    <p className="mt-1 text-ink-soft">{rt(p.key)}</p>
                  </details>
                )}
                <Submit className="btn-quiet">Save my move</Submit>
              </form>
            </details>
          );
  };
  const first = priority ? pack.pillars.filter((p) => p.key === priority) : pack.pillars;
  const rest = priority ? pack.pillars.filter((p) => p.key !== priority) : [];
  return (
    <div className="space-y-3">
      {first.map(one)}
      {rest.length > 0 && (
        <details className="group/other">
          <summary className="cursor-pointer text-sm text-link">Other pillars ({rest.length})</summary>
          <div className="mt-3 space-y-3">{rest.map(one)}</div>
        </details>
      )}
    </div>
  );
}
