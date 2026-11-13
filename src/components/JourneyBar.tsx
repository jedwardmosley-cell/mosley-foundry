"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Step = { key: string; label: string; next: string; href: string };
type Props = {
  steps: Step[];
  done: Record<string, boolean>;
  current: string | null;
  cycle: { day: number; week: number; phase: string; finished: boolean; seasonMonth?: number | null } | null;
};

/** Five steps, shown at the top of every client screen: what is done, where you are, and what comes next. */
export function JourneyBar({ steps, done, current, cycle }: Props) {
  const path = usePathname();
  if (path.startsWith("/onboarding") || path.startsWith("/account") || path.startsWith("/start")) return null;
  const here = steps.find((s) => path === s.href || path.startsWith(s.href + "/"))?.key;
  const next = steps.find((s) => s.key === current);
  const n = next ? steps.indexOf(next) + 1 : 0;

  const open = steps.find((s) => !done[s.key] && s.key !== "drive");
  let line: React.ReactNode;
  // On Today the big card already shows the day, so the bar only nudges about a skipped step.
  if (cycle && (path === "/dashboard" || path === "/cycle")) {
    line = open && !cycle.finished ? <span className="text-ink-mute">Still open: <Link href={open.href} className="btn-link">{open.label}</Link></span> : null;
  } else if (cycle) {
    line = cycle.finished
      ? <Link href="/cycle" className="btn-link">Your 30 days are up. Open your day 30 review</Link>
      : <Link href="/dashboard" className="hover:text-link">Day {cycle.day} of 30{cycle.seasonMonth ? ` · Month ${cycle.seasonMonth} of 3` : ""} · Week {cycle.week}{cycle.phase ? `, ${cycle.phase}` : ""} · <span className="btn-link">Check in today</span></Link>;
    if (open && !cycle.finished) line = <>{line} <span className="block sm:inline mt-1 sm:mt-0 text-ink-mute">Still open: <Link href={open.href} className="btn-link">{open.label}</Link></span></>;
  } else if (next) {
    line = <>Step {n} of 5 · <Link href={`/start?step=${n}`} className="btn-link">{next.next}</Link></>;
  }

  // On Today during the 30 days, the bar is one thin strip; the big card says the rest.
  if (cycle && path === "/dashboard") {
    return (
      <nav aria-label="Your journey" className="mb-4 flex items-center gap-3">
        <ol className="grid flex-1 grid-cols-5 gap-1">
          {steps.map((s, i) => (
            <li key={s.key}>
              <Link href={s.href} className="block py-1.5" title={s.label}>
                <span className={`block h-1 rounded-full ${done[s.key] ? "bg-navy" : s.key === current ? "bg-ink-mute/50" : "bg-line"}`} />
                <span className="sr-only">Step {i + 1}: {s.label}{done[s.key] && " (done)"}</span>
              </Link>
            </li>
          ))}
        </ol>
        {line && <span className="text-xs whitespace-nowrap">{line}</span>}
      </nav>
    );
  }

  return (
    <nav aria-label="Your journey" className="mb-6 rounded-2xl border border-line bg-card px-4 py-3">
      <div aria-hidden className="grid grid-cols-5 gap-1.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-heading">
        <span className="col-span-3">FORGE</span>
        <span className="col-span-2 border-l border-line pl-1.5">Discipline by Design</span>
      </div>
      <ol className="grid grid-cols-5 gap-1.5">
        {steps.map((s, i) => {
          const isDone = done[s.key];
          const isNext = s.key === current;
          const isHere = s.key === here;
          return (
            <li key={s.key}>
              <Link href={s.href} aria-current={isHere ? "step" : undefined} className="block group">
                <span className={`block h-1.5 rounded-full ${isDone ? "bg-navy" : isNext ? "bg-ink-mute/50" : "bg-line"}`} />
                <span className={`mt-1.5 block text-[11px] leading-tight sm:text-xs ${isHere ? "text-heading font-semibold" : isDone || isNext ? "text-ink-soft" : "text-ink-mute"} group-hover:text-link`}>
                  <span className="sr-only">Step {i + 1}: </span>{s.label}{isDone && <span className="sr-only"> (done)</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {line && <p className="mt-2 text-[13px] text-ink-soft">{line}</p>}
    </nav>
  );
}
