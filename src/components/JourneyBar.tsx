"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Step = { key: string; label: string; next: string; href: string };
type Props = {
  steps: Step[];
  done: Record<string, boolean>;
  current: string | null;
  cycle: { day: number; week: number; phase: string; finished: boolean; seasonMonth?: number | null } | null;
  /** What the Driver's Seat still needs, so "still open" says why. */
  identityMissing?: string[];
  /** What the system still needs. */
  roadMissing?: string[];
  /** This week's look back in the Mirrors is saved. */
  lookedBack?: boolean;
};

/** The Mirrors sit at the end of the bar under Discipline by Design. A weekly look back, not a setup step: it fills in for the week once saved. */
const MIRRORS = { href: "/reflect", label: "The Mirrors" };

/** Four setup steps plus the weekly Mirrors, shown at the top of every client screen: what is done, where you are, and what comes next. */
export function JourneyBar({ steps, done, current, cycle, identityMissing = [], roadMissing = [], lookedBack = false }: Props) {
  const path = usePathname();
  if (path.startsWith("/onboarding") || path.startsWith("/account") || path.startsWith("/start") || path.startsWith("/forge") || path.startsWith("/cycle/setup")) return null;
  const here = steps.find((s) => path === s.href || path.startsWith(s.href + "/"))?.key;
  const atMirrors = path === MIRRORS.href;
  const next = steps.find((s) => s.key === current);
  const n = next ? steps.indexOf(next) + 1 : 0;
  // During the kickoff, Today's own card lists the four steps.
  if (next && path === "/dashboard") return null;

  const open = steps.find((s) => !done[s.key] && s.key !== "drive");
  let line: React.ReactNode;
  // On Today the big card already shows the day, so the bar only nudges about a skipped step.
  if (next && (!cycle || !cycle.finished)) {
    // The kickoff comes first: no "Check in today" until all four steps are done.
    const needs = next.key === "identity" ? identityMissing : next.key === "road" ? roadMissing : [];
    line = next.key === "road"
      ? <><span className="font-bold text-heading">Build your system first.</span> <Link href={`/start?step=${n}`} className="btn-link">Still needed: {needs.join(", ")}</Link></>
      : <><span className="font-bold text-heading">Build your system first.</span> Step {n} of 4: <Link href={`/start?step=${n}`} className="btn-link">{next.next}</Link>{needs.length > 0 && <span className="text-ink-mute"> (still needs {needs.join(", ")})</span>}</>;
  } else if (cycle && (path === "/dashboard" || path === "/cycle")) {
    line = open && !cycle.finished ? <span className="text-ink-mute">Still open: <Link href={open.href} className="btn-link">{open.label}</Link>{open.key === "identity" && identityMissing.length > 0 && <> ({identityMissing.join(", ")})</>}</span> : null;
  } else if (cycle) {
    line = cycle.finished
      ? <Link href="/cycle" className="btn-link">Your 30 days are up. Open your day 30 review</Link>
      : <Link href="/dashboard" className="hover:text-link">Day {cycle.day} of 30, week {cycle.week}{cycle.seasonMonth ? `, month ${cycle.seasonMonth} of 3` : ""}. <span className="btn-link">Check in today</span></Link>;
    if (open && !cycle.finished) line = <>{line}<span className="hidden sm:inline"> </span><span className="block sm:inline mt-1 sm:mt-0 text-ink-mute">Still open: <Link href={open.href} className="btn-link">{open.label}</Link>{open.key === "identity" && identityMissing.length > 0 && <> ({identityMissing.join(", ")})</>}</span></>;
  } else if (next) {
    line = <>Step {n} of 4: <Link href={`/start?step=${n}`} className="btn-link">{next.next}</Link></>;
  }

  // On Today during the 30 days, the bar is one thin strip; the big card says the rest.
  if (cycle && path === "/dashboard" && !next) {
    return (
      <nav aria-label="Your journey" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <ol className="grid flex-1 min-w-[150px] grid-cols-5 gap-1">
          {steps.map((s, i) => (
            <li key={s.key}>
              <Link href={s.href} className="block py-1.5" title={s.label}>
                <span className={`block h-1 rounded-full ${done[s.key] ? "bg-navy" : s.key === current ? "bg-ink-mute/45" : "bg-ink/[0.08]"}`} />
                <span className="sr-only">Step {i + 1}: {s.label}{done[s.key] && " (done)"}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href={MIRRORS.href} className="block py-1.5" title={`${MIRRORS.label}, this week`}>
              <span className={`block h-1 rounded-full ${lookedBack ? "bg-navy" : "bg-ink/[0.08]"}`} />
              <span className="sr-only">{MIRRORS.label}{lookedBack ? ", looked back this week" : ", not yet this week"}</span>
            </Link>
          </li>
        </ol>
        {line && <span className="text-xs">{line}</span>}
      </nav>
    );
  }

  return (
    <nav aria-label="Your journey" className="mb-8">
      <div aria-hidden className="grid grid-cols-5 gap-1.5 mb-2 text-[13px] font-bold text-gold">
        <span className="col-span-2">FORGE</span>
        <span className="col-span-3">Discipline by Design</span>
      </div>
      <ol className="grid grid-cols-5 gap-1.5">
        {steps.map((s, i) => {
          const isDone = done[s.key];
          const isNext = s.key === current;
          const isHere = s.key === here;
          return (
            <li key={s.key}>
              <Link href={s.href} aria-current={isHere ? "step" : undefined} className="block group">
                <span className={`block h-[5px] rounded-full transition ${isDone ? "bg-navy" : isNext ? "bg-ink-mute/45" : "bg-ink/[0.08]"} ${isHere ? "ring-2 ring-navy/15" : ""}`} />
                <span className={`mt-2 block text-[11px] leading-tight sm:text-xs ${isHere ? "text-heading font-semibold" : isDone || isNext ? "text-ink-soft" : "text-ink-mute"} group-hover:text-link`}>
                  <span className="sr-only">Step {i + 1}: </span>{s.label}{isDone && <span className="sr-only"> (done)</span>}
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link href={MIRRORS.href} aria-current={atMirrors ? "page" : undefined} className="block group" title={lookedBack ? "Looked back this week" : "Look back at your week"}>
            <span className={`block h-[5px] rounded-full transition ${lookedBack ? "bg-navy" : "bg-ink/[0.08]"} ${atMirrors ? "ring-2 ring-navy/15" : ""}`} />
            <span className={`mt-2 block text-[11px] leading-tight sm:text-xs ${atMirrors ? "text-heading font-semibold" : lookedBack ? "text-ink-soft" : "text-ink-mute"} group-hover:text-link`}>
              {MIRRORS.label}<span className="sr-only">{lookedBack ? ", looked back this week" : ", not yet this week"}</span>
            </span>
          </Link>
        </li>
      </ol>
      {line && <p className="mt-3 text-[13px] text-ink-soft">{line}</p>}
    </nav>
  );
}
