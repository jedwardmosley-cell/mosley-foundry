"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Step = { key: string; label: string; next: string; href: string };
type Props = {
  steps: Step[];
  done: Record<string, boolean>;
  current: string | null;
  cycle: { day: number; week: number; phase: string; finished: boolean } | null;
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
  if (cycle && path === "/dashboard") {
    line = open && !cycle.finished ? <span className="text-ink-mute">Still open: <Link href={open.href} className="btn-link">{open.label}</Link></span> : null;
  } else if (cycle) {
    line = cycle.finished
      ? <Link href="/cycle" className="btn-link">Your 30 days are up. Open your day 30 review</Link>
      : <Link href="/dashboard" className="hover:text-navy">Day {cycle.day} of 30 · Week {cycle.week}{cycle.phase ? `, ${cycle.phase}` : ""} · <span className="btn-link">Check in today</span></Link>;
    if (open && !cycle.finished) line = <>{line} <span className="block sm:inline mt-1 sm:mt-0 text-ink-mute">Still open: <Link href={open.href} className="btn-link">{open.label}</Link></span></>;
  } else if (next) {
    line = <>Step {n} of 5 · <Link href={`/start?step=${n}`} className="btn-link">{next.next}</Link></>;
  }

  return (
    <nav aria-label="Your journey" className="mb-6 rounded-2xl border border-line bg-card px-4 py-3">
      <ol className="grid grid-cols-5 gap-1.5">
        {steps.map((s, i) => {
          const isDone = done[s.key];
          const isNext = s.key === current;
          const isHere = s.key === here;
          return (
            <li key={s.key}>
              <Link href={s.href} aria-current={isHere ? "step" : undefined} className="block group">
                <span className={`block h-1.5 rounded-full ${isDone ? "bg-sage" : isNext ? "bg-brass" : "bg-line"}`} />
                <span className={`mt-1.5 block text-[11px] leading-tight sm:text-xs ${isHere ? "text-navy-deep font-semibold" : isDone || isNext ? "text-ink-soft" : "text-ink-mute"} group-hover:text-navy`}>
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
