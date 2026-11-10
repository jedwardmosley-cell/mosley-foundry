import Link from "next/link";
import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth";
import { NavLink } from "./NavLink";
import { signOut } from "@/app/actions/auth";

const PARTICIPANT_NAV = [
  { href: "/dashboard", label: "Today", mobile: true },
  { href: "/cycle", label: "30-Day Cycle", mobile: true },
  { href: "/plan", label: "FORGE Plan", mobile: true },
  { href: "/network", label: "People", mobile: true },
  { href: "/more", label: "More", mobile: true, desktop: false },
  { href: "/assessment", label: "FORGE Assessment" },
  { href: "/blueprint", label: "Blueprint" },
  { href: "/reflect", label: "Weekly Reflection" },
  { href: "/pathway", label: "My Pathway" },
  { href: "/library", label: "Road Library" },
  { href: "/companion", label: "AI Companion" },
  { href: "/coaching", label: "Coaching" },
  { href: "/journal", label: "Private Journal" },
  { href: "/history", label: "History & Export" },
  { href: "/sharing", label: "Sharing" },
  { href: "/settings", label: "Settings" },
];

const COACH_NAV = [
  { href: "/coach", label: "Participants", mobile: true },
  { href: "/coach/cohorts", label: "Cohorts", mobile: true },
];
const ADMIN_NAV = [
  { href: "/admin", label: "Programs", mobile: true },
  { href: "/admin/reports", label: "Reports", mobile: true },
];

export function Shell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const nav = user.role === "COACH" ? COACH_NAV : user.role === "ADMIN" ? ADMIN_NAV : PARTICIPANT_NAV;
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-line md:bg-card md:px-5 md:py-6 md:sticky md:top-0 md:h-screen">
        <Brand />
        <nav className="mt-8 flex-1 space-y-0.5 overflow-y-auto" aria-label="Main">
          {nav.filter((n) => (n as { desktop?: boolean }).desktop !== false).map((n) => (
            <NavLink key={n.href} href={n.href} variant="side">{n.label}</NavLink>
          ))}
        </nav>
        <UserBox user={user} />
      </aside>

      <div className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-line bg-card sticky top-0 z-20">
          <Brand compact />
          <form action={signOut}><button className="text-sm text-ink-soft">Sign out</button></form>
        </header>
        {user.isDemo && (
          <div className="bg-brass-soft text-[13px] text-ink px-4 py-2 text-center">
            Demo account. All people and data shown are fictional.
          </div>
        )}
        <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-6 sm:py-10 pb-28 md:pb-12">{children}</main>
      </div>

      <nav aria-label="Primary" className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-card/95 backdrop-blur grid" style={{ gridTemplateColumns: `repeat(${nav.filter((n) => n.mobile).length}, minmax(0, 1fr))` }}>
        {nav.filter((n) => n.mobile).map((n) => (
          <NavLink key={n.href} href={n.href} variant="tab">{n.label.replace("30-Day ", "").replace("FORGE ", "")}</NavLink>
        ))}
      </nav>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="block">
      <span className="font-serif text-navy-deep text-[19px] leading-none">Both Hands on the Wheel</span>
      {!compact && <span className="block mt-1.5 text-[11px] tracking-[0.14em] uppercase text-ink-mute">Mosley Foundry</span>}
    </Link>
  );
}

function UserBox({ user }: { user: CurrentUser }) {
  return (
    <div className="border-t border-line pt-4 text-sm">
      <p className="font-medium text-ink truncate">{user.name}</p>
      <p className="text-ink-mute text-xs capitalize">{user.role.toLowerCase()}</p>
      <form action={signOut} className="mt-2"><button className="text-ink-soft hover:text-ink text-sm">Sign out</button></form>
    </div>
  );
}
