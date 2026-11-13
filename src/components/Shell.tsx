import Link from "next/link";
import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth";
import { NavLink } from "./NavLink";
import { signOut } from "@/app/actions/auth";

// Client menu, in journey order. The phone tab bar keeps five tabs; everything else is under More.
const PARTICIPANT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Today", mobile: true },
  { href: "/identity", label: "1. Who I am", group: "FORGE" },
  { href: "/plan", label: "2. FORGE identity", tab: "Plan", mobile: true, group: "FORGE" },
  { href: "/assessment", label: "3. Where I am", group: "FORGE" },
  { href: "/blueprint", label: "4. My road", group: "Discipline by Design" },
  { href: "/cycle", label: "5. 30 days", group: "Discipline by Design" },
  { href: "/reflect", label: "Weekly reflection", group: "Discipline by Design" },
  { href: "/network", label: "People", mobile: true, group: "Support" },
  { href: "/coaching", label: "Coaching", tab: "Coach", mobile: true, group: "Support" },
  { href: "/companion", label: "AI companion", group: "Support" },
  { href: "/more", label: "More", mobile: true, desktop: false },
  { href: "/more", label: "More", group: "Support" },
];
type NavItem = { href: string; label: string; tab?: string; mobile?: boolean; desktop?: boolean; group?: string };
const GUIDE_TAB = { href: "/guide", label: "Guide", mobile: true };

const COACH_NAV = [
  { href: "/coach", label: "My clients", mobile: true },
  { href: "/coach/cohorts", label: "Cohorts", mobile: true },
];
const ADMIN_NAV = [
  { href: "/admin", label: "Programs", mobile: true },
  { href: "/admin/reports", label: "Reports", mobile: true },
];

export function Shell({ user, children, journey }: { user: CurrentUser; children: ReactNode; journey?: ReactNode }) {
  const nav = user.role === "COACH" ? [...COACH_NAV, GUIDE_TAB] : user.role === "ADMIN" ? (user.alsoCoach ? [...ADMIN_NAV, ...COACH_NAV, GUIDE_TAB] : [...ADMIN_NAV, GUIDE_TAB]) : PARTICIPANT_NAV;
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-line md:bg-card md:px-5 md:py-6 md:sticky md:top-0 md:h-screen">
        <Brand />
        <nav className="mt-8 flex-1 space-y-0.5 overflow-y-auto" aria-label="Main">
          {(nav as NavItem[]).filter((n) => n.desktop !== false).map((n, i, all) => (
            <div key={n.href + n.label}>
              {n.group && n.group !== all[i - 1]?.group && <p className={`mt-5 mb-1 px-3 text-[11px] uppercase tracking-[0.12em] ${n.group === "Support" ? "text-ink-mute" : "font-semibold text-heading"}`}>{n.group}</p>}
              <NavLink href={n.href} variant="side">{n.label}</NavLink>
            </div>
          ))}
        </nav>
        <UserBox user={user} />
      </aside>

      <div className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-line bg-card sticky top-0 z-20">
          <Brand compact />
          <div className="flex items-center gap-4 text-sm text-ink-soft"><Link href="/account/password">Password</Link><form action={signOut}><button>Sign out</button></form></div>
        </header>
        {user.isDemo && (
          <div className="bg-brass-soft text-[13px] text-ink px-4 py-2 text-center">
            Demo account. All people and data shown are fictional.
          </div>
        )}
        <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-6 sm:py-10 pb-28 md:pb-12">{journey}{children}</main>
      </div>

      {/* Phone: a floating, frosted menu bar. Clients also get a round button for the AI companion. */}
      <div className="md:hidden fixed bottom-3 inset-x-3 z-30 flex items-end gap-2">
        <nav aria-label="Primary" className="flex-1 grid rounded-full border border-line/60 bg-card/80 backdrop-blur-xl shadow-[0_12px_32px_-12px_rgb(0_0_0/0.35)]" style={{ gridTemplateColumns: `repeat(${nav.filter((n) => n.mobile).length}, minmax(0, 1fr))` }}>
          {(nav as NavItem[]).filter((n) => n.mobile).map((n) => (
            <NavLink key={n.href} href={n.href} variant="tab">{n.tab ?? n.label}</NavLink>
          ))}
        </nav>
        {user.role === "PARTICIPANT" && (
          <Link href="/companion" aria-label="AI companion" className="h-[54px] w-[54px] shrink-0 grid place-items-center rounded-full border border-line/60 bg-card/80 backdrop-blur-xl text-heading shadow-[0_12px_32px_-12px_rgb(0_0_0/0.35)]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /><path d="M18.5 2.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor" stroke="none" /></svg>
          </Link>
        )}
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="block">
      <span className="font-serif text-heading text-[19px] leading-none">Both Hands on the Wheel</span>
      {!compact && <span className="block mt-1.5 text-[11px] tracking-[0.14em] uppercase text-ink-mute">Mosley Foundry</span>}
    </Link>
  );
}

function UserBox({ user }: { user: CurrentUser }) {
  return (
    <div className="border-t border-line pt-4 text-sm">
      <p className="font-medium text-ink truncate">{user.name}</p>
      <p className="text-ink-mute text-xs capitalize">{user.role === "ADMIN" && user.alsoCoach ? "Administrator and coach" : user.role.toLowerCase()}</p>
      <Link href="/account/password" className="mt-2 block text-ink-soft hover:text-ink text-sm">Change password</Link>
      <form action={signOut} className="mt-1"><button className="text-ink-soft hover:text-ink text-sm">Sign out</button></form>
    </div>
  );
}
