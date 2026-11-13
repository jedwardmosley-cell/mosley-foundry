import Link from "next/link";
import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth";
import { NavLink } from "./NavLink";
import { BrandMark } from "./BrandMark";
import { signOut } from "@/app/actions/auth";

// Client menu, in journey order. The phone tab bar keeps five tabs; everything else is under More.
const PARTICIPANT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Today", mobile: true },
  { href: "/identity", label: "1. Who I am", tab: "Who I am", mobile: true, group: "FORGE" },
  { href: "/assessment", label: "2. Where I am", group: "FORGE" },
  { href: "/blueprint", label: "3. My road", group: "Discipline by Design" },
  { href: "/cycle", label: "4. 30 days", group: "Discipline by Design" },
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
      <aside className="hidden md:flex md:w-64 md:flex-col md:px-5 md:py-7 md:sticky md:top-0 md:h-screen md:border-r md:border-line/50">
        <Brand />
        <nav className="mt-8 flex-1 space-y-0.5 overflow-y-auto" aria-label="Main">
          {(nav as NavItem[]).filter((n) => n.desktop !== false).map((n, i, all) => (
            <div key={n.href + n.label}>
              {n.group && n.group !== all[i - 1]?.group && <p className={`mt-6 mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] ${n.group === "Support" ? "text-ink-mute" : "text-gold"}`}>{n.group}</p>}
              <NavLink href={n.href} variant="side">{n.label}</NavLink>
            </div>
          ))}
        </nav>
        <UserBox user={user} />
      </aside>

      <div className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-2.5 sticky top-0 z-20 bg-paper/75 backdrop-blur-xl">
          <Brand compact />
          <AccountMenu user={user} />
        </header>
        {user.isDemo && (
          <p className="mx-auto w-fit mt-2 md:mt-4 rounded-full bg-ink/[0.06] px-3 py-1 text-[12px] text-ink-mute">
            Demo account. All people and data are fictional.
          </p>
        )}
        <main className="mx-auto w-full max-w-3xl px-4 sm:px-8 py-5 sm:py-10 pb-28 md:pb-14">{journey}<div className="rise">{children}</div></main>
      </div>

      {/* Phone: a floating, frosted menu bar. Clients also get a round button for the AI companion. */}
      <div className="md:hidden fixed bottom-3 inset-x-3 z-30 flex items-end gap-2">
        <nav aria-label="Primary" className="flex-1 grid rounded-full border border-line/50 bg-card/85 backdrop-blur-xl shadow-[0_16px_40px_-14px_rgb(0_0_0/0.35)]" style={{ gridTemplateColumns: `repeat(${nav.filter((n) => n.mobile).length}, minmax(0, 1fr))` }}>
          {(nav as NavItem[]).filter((n) => n.mobile).map((n) => (
            <NavLink key={n.href} href={n.href} variant="tab">{n.tab ?? n.label}</NavLink>
          ))}
        </nav>
        {user.role === "PARTICIPANT" && (
          <Link href="/companion" aria-label="AI companion" className="h-[54px] w-[54px] shrink-0 grid place-items-center rounded-full text-white shadow-[0_16px_36px_-12px_rgb(var(--navy-deep)/0.8)] bg-[linear-gradient(160deg,rgb(var(--navy)),rgb(var(--navy-deep)))]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /><path d="M18.5 2.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor" stroke="none" /></svg>
          </Link>
        )}
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <BrandMark size={compact ? 26 : 30} className="text-heading shrink-0" />
      <span>
        <span className="block font-serif text-heading text-[19px] leading-none tracking-[-0.01em]">{compact ? "Both Hands" : "Both Hands on the Wheel"}</span>
        {!compact && <span className="block mt-1.5 text-[11px] tracking-[0.14em] uppercase text-ink-mute">Mosley Foundry</span>}
      </span>
    </Link>
  );
}

const initials = (name: string) => name.split(" (")[0].split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Phone: the person's initials open a small menu with password and sign out. */
function AccountMenu({ user }: { user: CurrentUser }) {
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer grid h-9 w-9 place-items-center rounded-full bg-navy/10 text-[13px] font-semibold text-heading" aria-label="Account">{initials(user.name)}</summary>
      <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-card p-2 text-[15px] shadow-[0_20px_44px_-16px_rgb(0_0_0/0.4)] border border-line/50">
        <p className="px-3 pt-1.5 pb-2 text-sm text-ink-mute truncate">{user.name}</p>
        <Link href="/account/password" className="block rounded-xl px-3 py-2 hover:bg-ink/[0.05]">Change password</Link>
        <form action={signOut}><button className="w-full text-left rounded-xl px-3 py-2 hover:bg-ink/[0.05]">Sign out</button></form>
      </div>
    </details>
  );
}

function UserBox({ user }: { user: CurrentUser }) {
  return (
    <div className="border-t border-line/60 pt-4 text-sm">
      <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy/10 text-xs font-semibold text-heading">{initials(user.name)}</span><p className="font-medium text-ink truncate">{user.name}</p></div>
      <p className="text-ink-mute text-xs">{user.role === "ADMIN" && user.alsoCoach ? "Administrator and coach" : ({ PARTICIPANT: "Participant", COACH: "Coach", ADMIN: "Administrator" } as Record<string, string>)[user.role]}</p>
      <Link href="/account/password" className="mt-2 block text-ink-soft hover:text-ink text-sm">Change password</Link>
      <form action={signOut} className="mt-1"><button className="text-ink-soft hover:text-ink text-sm">Sign out</button></form>
    </div>
  );
}
