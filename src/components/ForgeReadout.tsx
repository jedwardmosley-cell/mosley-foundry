import type { getContent } from "@/content";
import type { PillarKey } from "@/content/types";
import { PillarMark } from "./ui";

type Content = Awaited<ReturnType<typeof getContent>>;

/**
 * The profile readout after the ratings: for each rule, the score, the level the client chose
 * and what that level means, next to what they wrote. The goal is a 5 on every rule.
 */
export function ForgeReadout({ pack, scores, lines = {} }: { pack: Content["pack"]; scores: Record<PillarKey, number>; lines?: Partial<Record<PillarKey, string>> }) {
  return (
    <ul className="space-y-4">
      {pack.pillars.map((p) => {
        const v = scores[p.key];
        const an = p.anchors.find((a) => a.score === v);
        const mine = lines[p.key]?.trim();
        return (
          <li key={p.key} className="rounded-2xl bg-field p-4">
            <div className="flex items-center gap-3">
              <PillarMark k={p.key} size="sm" />
              <span className="flex-1 text-[15px] font-medium text-heading">{p.name}</span>
              <span className="text-sm text-ink-soft">{v} of 5</span>
            </div>
            <span className="mt-2.5 flex gap-1" aria-hidden>{[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= v ? "bg-navy" : "bg-ink/[0.08]"}`} />)}</span>
            {mine && <p className="mt-3 font-serif text-[16px] leading-snug text-heading">&ldquo;{mine}&rdquo;</p>}
            {an && <p className="mt-2 text-[14px] leading-snug text-ink-soft"><span className="font-medium text-ink">{an.level}.</span> {an.text}</p>}
          </li>
        );
      })}
    </ul>
  );
}
