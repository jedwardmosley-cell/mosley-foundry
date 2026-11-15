/**
 * My Design as a mind map: the client in the middle and four sections around them, like the first people map.
 * Who guides me (top), who walks with me (right), who I develop (bottom) and what I do (left).
 * Only what the client has added shows as a point; the sections are always labeled so the shape is clear.
 */
export type MapKind = "routine" | "guide" | "partner" | "group" | "develop" | "learning";
export type MapNode = { id: string; label: string; kind: MapKind; href: string; overdue?: boolean };

const COLOR: Record<MapKind, string> = {
  routine: "rgb(var(--navy))",
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
      const deg = sec.at - spread / 2 + (k > 1 ? (spread * i) / (k - 1) : 0);
      const r = R;
      return { ...node, deg, x: cx + r * Math.cos(rad(deg)), y: cy + r * Math.sin(rad(deg)) };
    });
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[440px] h-auto" role="img" aria-label={`My Design: ${nodes.length} ${nodes.length === 1 ? "thing" : "things"} around you`}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgb(var(--line))" strokeDasharray="3 5" />
      {/* The quadrant: four sections laid over the circle. */}
      {[45, 135, 225, 315].map((d) => (
        <line key={d} x1={cx + 44 * Math.cos(rad(d))} y1={cy + 44 * Math.sin(rad(d))} x2={cx + (R + 34) * Math.cos(rad(d))} y2={cy + (R + 34) * Math.sin(rad(d))} stroke="rgb(var(--line))" strokeWidth={1} />
      ))}
      {placed.map((p) => (
        <line key={`l${p.id}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={p.overdue ? "rgb(var(--alert))" : "rgb(var(--ink-mute) / 0.45)"} strokeWidth={1.25} strokeDasharray={p.overdue ? "4 4" : undefined} />
      ))}
      <circle cx={cx} cy={cy} r={34} fill="rgb(var(--navy))" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fill="#fff" fontFamily="Georgia, serif">{name.split(" ")[0].slice(0, 12)}</text>
      {placed.map((p) => {
        const up = Math.sin(rad(p.deg)) < -0.3;
        return (
          <a key={p.id} href={p.href} aria-label={`${p.label}, ${KIND_NAME[p.kind]}`}>
            {p.id.startsWith("more-") ? <circle cx={p.x} cy={p.y} r={8} fill="rgb(var(--card))" stroke={COLOR[p.kind]} strokeWidth={2} /> : <circle cx={p.x} cy={p.y} r={8} fill={COLOR[p.kind]} />}
            <text x={p.x} y={up ? p.y - 14 : p.y + 22} textAnchor="middle" fontSize="11" fill="rgb(var(--ink))">{p.label.length > 18 ? p.label.slice(0, 17) + "…" : p.label}</text>
          </a>
        );
      })}
      <text x={cx} y={16} textAnchor="middle" fontSize="10" letterSpacing="1.5" fill="rgb(var(--ink-mute))">WHO GUIDES ME</text>
      <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" letterSpacing="1.5" fill="rgb(var(--ink-mute))">WHO I DEVELOP</text>
      <text transform={`translate(${W - 8} ${cy}) rotate(90)`} textAnchor="middle" fontSize="10" letterSpacing="1.5" fill="rgb(var(--ink-mute))">WHO WALKS WITH ME</text>
      <text transform={`translate(10 ${cy}) rotate(-90)`} textAnchor="middle" fontSize="10" letterSpacing="1.5" fill="rgb(var(--ink-mute))">WHAT I DO</text>
      {nodes.length === 0 && <text x={cx} y={cy + 66} textAnchor="middle" fontSize="12" fill="rgb(var(--ink-mute))">Add a routine or a person and it shows up here.</text>}
    </svg>
  );
}
