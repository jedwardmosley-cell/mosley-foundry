/**
 * the Vehicle Controls as a mind map: the client in the middle and four sections around them, like the first people map.
 * Who guides me (top), who walks with me (right), who I develop (bottom) and what I do (left).
 * Only what the client has added shows as a point; the sections are always labeled so the shape is clear.
 */
export type MapKind = "routine" | "guide" | "partner" | "group" | "develop" | "learning";
export type MapNode = { id: string; label: string; kind: MapKind; href: string; overdue?: boolean };

const COLOR: Record<MapKind, string> = {
  routine: "rgb(var(--navy))",  // sign green: what I do
  learning: "rgb(var(--violet))",
  guide: "rgb(var(--sage))",
  partner: "rgb(var(--clay))",
  group: "rgb(var(--gold))",
  develop: "rgb(var(--brass))",
};
const KIND_NAME: Record<MapKind, string> = { routine: "routine", learning: "learning", guide: "mentor or coach", partner: "accountability partner", group: "group or program", develop: "someone I develop" };

/** The four sections: where each sits on the circle (degrees, 0 = right) and what goes in it. */
const SECTIONS = [
  { title: "WHO GUIDES ME", at: -90, kinds: ["guide"] as MapKind[], more: "/network" },
  { title: "WHO WALKS WITH ME", at: 0, kinds: ["partner", "group"] as MapKind[], more: "/network" },
  { title: "WHO I DEVELOP", at: 90, kinds: ["develop"] as MapKind[], more: "/network" },
  { title: "WHAT I DO", at: 180, kinds: ["routine", "learning"] as MapKind[], more: "#area-ROUTINES" },
];

export function SystemMap({ name, nodes }: { name: string; nodes: MapNode[] }) {
  const W = 440, H = 420, cx = W / 2, cy = H / 2, R = 130;
  const rad = (d: number) => (d * Math.PI) / 180;
  const placed = SECTIONS.flatMap((sec) => {
    const all = nodes.filter((x) => sec.kinds.includes(x.kind)).sort((a, b) => sec.kinds.indexOf(a.kind) - sec.kinds.indexOf(b.kind));
    // Up to four points per section; past that, three and a "+ n more" that opens the full list.
    const list: MapNode[] = all.length > 4
      ? [...all.slice(0, 3), { id: `more-${sec.at}`, label: `+ ${all.length - 3} more`, kind: all[3].kind, href: sec.more }]
      : all;
    const k = list.length;
    const spread = Math.min(72, 24 * Math.max(k - 1, 0));
    return list.map((node, i) => {
      // The center line runs top to bottom, so the top and bottom sections sit a little to one side of it.
      const offRoad = Math.abs(Math.sin(rad(sec.at))) > 0.9 ? 14 : 0;
      const deg = sec.at + offRoad - spread / 2 + (k > 1 ? (spread * i) / (k - 1) : 0);
      const r = R;
      return { ...node, deg, x: cx + r * Math.cos(rad(deg)), y: cy + r * Math.sin(rad(deg)) };
    });
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[440px] h-auto" role="img" aria-label={`The Vehicle Controls: ${nodes.length} ${nodes.length === 1 ? "thing" : "things"} around you`}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgb(var(--line))" strokeDasharray="3 5" />
      {/* The road through the middle: the center line runs from who guides you to who you develop, crossed by who walks with you and what you do. */}
      <line x1={cx} y1={28} x2={cx} y2={H - 26} stroke="rgb(var(--lane))" strokeWidth={4} strokeDasharray="14 9" />
      <line x1={36} y1={cy} x2={W - 36} y2={cy} stroke="rgb(var(--line))" strokeWidth={1.5} />
      {placed.map((p) => (
        <line key={`l${p.id}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={p.overdue ? "rgb(var(--alert))" : "rgb(var(--ink-mute) / 0.45)"} strokeWidth={p.overdue ? 2 : 1.25} strokeDasharray={p.overdue ? "4 4" : undefined} />
      ))}
      <circle cx={cx} cy={cy} r={34} fill="rgb(var(--ink))" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fontWeight={800} fill="rgb(var(--paper))">{name.split(" ")[0].slice(0, 12)}</text>
      {placed.map((p) => {
        const up = Math.sin(rad(p.deg)) < -0.3;
        return (
          <a key={p.id} href={p.href} aria-label={`${p.label}, ${KIND_NAME[p.kind]}`}>
            {p.id.startsWith("more-") ? <circle cx={p.x} cy={p.y} r={8} fill="rgb(var(--card))" stroke={COLOR[p.kind]} strokeWidth={2} /> : <circle cx={p.x} cy={p.y} r={8} fill={COLOR[p.kind]} />}
            {(() => {
              const lines = wrapLabel(p.label);
              const y0 = up ? p.y - 14 - (lines.length - 1) * 14 : p.y + 22;
              return <text x={p.x} y={y0} textAnchor="middle" fontSize="12" fontWeight={600} fill="rgb(var(--ink))">{lines.map((l, i) => <tspan key={i} x={p.x} dy={i === 0 ? 0 : 14}>{l}</tspan>)}</text>;
            })()}
          </a>
        );
      })}
      <g fontSize="12" fontWeight={700} fill="rgb(var(--ink-mute))">
        <text x={cx} y={16} textAnchor="middle">Who guides me</text>
        <text x={cx} y={H - 8} textAnchor="middle">Who I develop</text>
        <text transform={`translate(${W - 24} ${cy}) rotate(90)`} textAnchor="middle">Who walks with me</text>
        <text transform={`translate(24 ${cy}) rotate(-90)`} textAnchor="middle">What I do</text>
      </g>
      {nodes.length === 0 && <text x={cx} y={cy + 66} textAnchor="middle" fontSize="12" fill="rgb(var(--ink-mute))">Add a routine or a person and it shows up here.</text>}
    </svg>
  );
}

/** Two short lines instead of a cut-off label, so "Saturday look back" reads in full. */
function wrapLabel(label: string, max = 16): string[] {
  if (label.length <= max) return [label];
  const words = label.split(/\s+/);
  let first = "";
  while (words.length && (first ? first.length + 1 : 0) + words[0].length <= max) first += (first ? " " : "") + words.shift();
  if (!first) first = words.shift() ?? "";
  let rest = words.join(" ");
  if (rest.length > max) rest = rest.slice(0, max - 1).trimEnd() + "…";
  return rest ? [first, rest] : [first];
}
