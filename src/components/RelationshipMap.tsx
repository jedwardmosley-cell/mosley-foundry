import { RELATIONSHIP_ROLES } from "@/content/program";

type Rel = { id: string; name: string; role: string; overdue: boolean };

const RING: Record<string, number> = { MENTOR: 0, COACH: 0, ACCOUNTABILITY_PARTNER: 1, GROUP: 1, MENTEE: 2, DIRECT_REPORT: 2 };
const TONE: Record<string, string> = { MENTOR: "rgb(var(--link))", COACH: "rgb(var(--link))", ACCOUNTABILITY_PARTNER: "rgb(var(--heading))", GROUP: "rgb(var(--ink-mute))", MENTEE: "rgb(var(--ink-soft))", DIRECT_REPORT: "rgb(var(--ink-soft))" };

/** You at the center. People who guide you, people beside you, people you develop. */
export function RelationshipMap({ name, rels }: { name: string; rels: Rel[] }) {
  const W = 360, H = 300, cx = W / 2, cy = H / 2;
  const groups = [0, 1, 2].map((ring) => rels.filter((r) => (RING[r.role] ?? 1) === ring));
  const sector = [-90, 30, 150]; // guide above, beside to the right-below, develop to the left-below
  const nodes = groups.flatMap((g, ring) =>
    g.map((r, i) => {
      const spread = Math.min(100, 28 * Math.max(g.length - 1, 0));
      const angle = ((sector[ring] - spread / 2 + (g.length > 1 ? (spread * i) / (g.length - 1) : 0)) * Math.PI) / 180;
      const rad = 105;
      return { ...r, x: cx + rad * Math.cos(angle), y: cy + rad * Math.sin(angle) };
    })
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Relationship map: ${rels.length} people`}>
      <circle cx={cx} cy={cy} r={105} fill="none" stroke="rgb(var(--line))" strokeDasharray="3 5" />
      {nodes.map((n) => (
        <line key={`l${n.id}`} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={n.overdue ? "rgb(var(--alert))" : "rgb(var(--ink-mute) / 0.5)"} strokeWidth={1.25} strokeDasharray={n.overdue ? "4 4" : undefined} />
      ))}
      <circle cx={cx} cy={cy} r={30} fill="#15223A" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="12" fill="#fff" fontFamily="Georgia, serif">{name.split(" ")[0]}</text>
      {nodes.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={9} fill={TONE[n.role] ?? "rgb(var(--ink-mute))"} />
          <text x={n.x} y={n.y + 24} textAnchor="middle" fontSize="11" fill="rgb(var(--ink))">{n.name.length > 16 ? n.name.slice(0, 15) + "…" : n.name}</text>
          <text x={n.x} y={n.y + 37} textAnchor="middle" fontSize="9.5" fill="rgb(var(--ink-mute))">{RELATIONSHIP_ROLES[n.role as keyof typeof RELATIONSHIP_ROLES]}</text>
        </g>
      ))}
      <text x={cx} y={18} textAnchor="middle" fontSize="10" fill="rgb(var(--ink-mute))" letterSpacing="1.5">WHO GUIDES ME</text>
      <text x={W - 8} y={H - 8} textAnchor="end" fontSize="10" fill="rgb(var(--ink-mute))" letterSpacing="1.5">WHO WALKS WITH ME</text>
      <text x={8} y={H - 8} fontSize="10" fill="rgb(var(--ink-mute))" letterSpacing="1.5">WHO I DEVELOP</text>
    </svg>
  );
}
