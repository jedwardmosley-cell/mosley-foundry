/**
 * My Design as one picture: the client in the center and one spoke for each area of Discipline by Design.
 * A filled circle shows how many things are in that area. An open circle is a slot still to fill: tap it to add.
 * The map grows as the system does.
 */
export type MapArea = { key: string; label: string; count: number; href: string; firstItem?: string };

export function SystemMap({ name, areas }: { name: string; areas: MapArea[] }) {
  const W = 440, H = 340, cx = W / 2, cy = H / 2, R = 100, LR = 124;
  const n = areas.length;
  const filled = areas.filter((a) => a.count > 0).length;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[420px] h-auto" role="img" aria-label={`My Design: ${filled} of ${n} areas in place`}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgb(var(--line))" strokeDasharray="3 5" />
        {areas.map((a, i) => {
          const ang = (-90 + (360 / n) * i) * (Math.PI / 180);
          const x = cx + R * Math.cos(ang), y = cy + R * Math.sin(ang);
          const lx = cx + LR * Math.cos(ang), ly = cy + LR * Math.sin(ang);
          const anchor = Math.abs(Math.cos(ang)) < 0.2 ? "middle" : Math.cos(ang) > 0 ? "start" : "end";
          const on = a.count > 0;
          return (
            <a key={a.key} href={a.href} aria-label={`${a.label}: ${on ? `${a.count} in place` : "open, tap to add"}`}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke={on ? "rgb(var(--navy) / 0.55)" : "rgb(var(--ink-mute) / 0.3)"} strokeWidth={on ? 1.5 : 1} strokeDasharray={on ? undefined : "3 4"} />
              {on ? (
                <>
                  <circle cx={x} cy={y} r={15} fill="rgb(var(--navy))" />
                  <text x={x} y={y + 4.5} textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff">{a.count}</text>
                </>
              ) : (
                <>
                  <circle cx={x} cy={y} r={15} fill="rgb(var(--card))" stroke="rgb(var(--ink-mute) / 0.6)" strokeDasharray="3 3" />
                  <text x={x} y={y + 5} textAnchor="middle" fontSize="16" fill="rgb(var(--ink-mute))">+</text>
                </>
              )}
              <text x={lx} y={ly + (Math.sin(ang) > 0.5 ? 10 : Math.sin(ang) < -0.5 ? -2 : 4)} textAnchor={anchor} fontSize="11.5" fill={on ? "rgb(var(--heading))" : "rgb(var(--ink-mute))"} fontWeight={on ? 600 : 400}>{a.label}</text>
            </a>
          );
        })}
        <circle cx={cx} cy={cy} r={36} fill="rgb(var(--navy))" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fill="#fff" fontFamily="Georgia, serif">{name.split(" ")[0].slice(0, 12)}</text>
      </svg>
      <figcaption className="mt-2 text-center text-sm text-ink-soft">{filled} of {n} areas in place.{filled < n && " Tap an open circle to add to it."}</figcaption>
    </figure>
  );
}
