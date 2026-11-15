/**
 * My Design as one picture: the client in the middle and everything they have built around them,
 * routines, people, groups and programs, the people they develop. Only what is really there shows,
 * so the map starts with just their name and fills in as the design grows.
 */
export type MapKind = "routine" | "guide" | "partner" | "group" | "develop" | "learning";
export type MapNode = { id: string; label: string; kind: MapKind; href: string; overdue?: boolean };

export const KIND: Record<MapKind, { name: string; color: string }> = {
  routine: { name: "Routines and habits", color: "rgb(var(--navy))" },
  partner: { name: "Accountability", color: "rgb(var(--clay))" },
  guide: { name: "Mentors and coaches", color: "rgb(var(--sage))" },
  group: { name: "Groups and programs", color: "rgb(var(--gold))" },
  learning: { name: "Learning", color: "rgb(var(--violet))" },
  develop: { name: "People I develop", color: "rgb(var(--brass))" },
};
const ORDER: MapKind[] = ["routine", "partner", "guide", "group", "learning", "develop"];

export function SystemMap({ name, nodes }: { name: string; nodes: MapNode[] }) {
  const W = 440, H = 360, cx = W / 2, cy = H / 2;
  const sorted = [...nodes].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const n = sorted.length;
  // One ring; a second, closer ring takes every other item once there are many.
  const placed = sorted.map((node, i) => {
    const ang = (-90 + (360 / Math.max(n, 1)) * i) * (Math.PI / 180);
    const r = n > 12 && i % 2 ? 92 : 128;
    return { ...node, ang, x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
  });
  const kinds = ORDER.filter((k) => sorted.some((x) => x.kind === k));
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[440px] h-auto" role="img" aria-label={`My Design: ${n} ${n === 1 ? "thing" : "things"} around you`}>
        <circle cx={cx} cy={cy} r={128} fill="none" stroke="rgb(var(--line))" strokeDasharray="3 5" />
        {placed.map((p) => (
          <line key={`l${p.id}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={p.overdue ? "rgb(var(--alert))" : "rgb(var(--ink-mute) / 0.45)"} strokeWidth={1.25} strokeDasharray={p.overdue ? "4 4" : undefined} />
        ))}
        <circle cx={cx} cy={cy} r={34} fill="rgb(var(--navy))" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fill="#fff" fontFamily="Georgia, serif">{name.split(" ")[0].slice(0, 12)}</text>
        {placed.map((p) => {
          const below = Math.sin(p.ang) > -0.3;
          return (
            <a key={p.id} href={p.href} aria-label={`${p.label}, ${KIND[p.kind].name}`}>
              <circle cx={p.x} cy={p.y} r={8} fill={KIND[p.kind].color} />
              <text x={p.x} y={below ? p.y + 22 : p.y - 14} textAnchor="middle" fontSize="11" fill="rgb(var(--ink))">{p.label.length > 18 ? p.label.slice(0, 17) + "…" : p.label}</text>
            </a>
          );
        })}
        {n === 0 && <text x={cx} y={cy + 70} textAnchor="middle" fontSize="12" fill="rgb(var(--ink-mute))">Add a routine or a person and it shows up here.</text>}
      </svg>
      {kinds.length > 0 && (
        <figcaption className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-ink-soft">
          {kinds.map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: KIND[k].color }} />{KIND[k].name}</span>)}
        </figcaption>
      )}
    </figure>
  );
}
