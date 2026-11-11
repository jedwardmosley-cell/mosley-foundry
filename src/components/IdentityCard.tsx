import Link from "next/link";
import { LEVELS, type IdentityLevel } from "@/content/identity";
import type { Pillar } from "@/content/types";
import { PillarMark } from "./ui";

type Id = { level: string; becoming: string; behavior: string; personaName: string; personaStandards: string };

/** Compact identity card for the Today screen. Shows only for people who chose to use the identity layer. */
export function IdentityCard({ id, priority }: { id: Id; priority?: Pillar | null }) {
  const l = LEVELS[id.level as IdentityLevel];
  const standard = id.personaStandards.split(/\n|(?<=[.!?])\s/)[0];
  return (
    <section className="card relative overflow-hidden">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: l.color }} />
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Who I am</p>
        <Link href="/identity" className="text-sm btn-link">Edit</Link>
      </div>
      <p className="mt-2 font-serif text-lg leading-relaxed">{id.becoming}</p>
      {id.level === "REINVENT" && id.personaName && (
        <p className="mt-2 text-[15px]"><span className="text-ink-mute">Performance identity: </span><span className="font-medium">{id.personaName}</span>{standard ? <span className="text-ink-soft">. Standard: {standard}</span> : null}</p>
      )}
      {id.behavior && <p className="mt-2 text-[15px]"><span className="text-ink-mute">The behavior that shows it: </span>{id.behavior}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="chip" style={{ borderColor: l.color, color: l.color }}>Level {l.n} · {l.name}</span>
        {priority && <span className="inline-flex items-center gap-1.5 text-ink-soft"><PillarMark k={priority.key} size="sm" /> {priority.name}</span>}
      </div>
    </section>
  );
}
