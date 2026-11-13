"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children, variant }: { href: string; children: ReactNode; variant: "side" | "tab" }) {
  const path = usePathname();
  const active = path === href || (href !== "/coach" && href !== "/admin" && path.startsWith(href + "/"));
  if (variant === "tab") {
    return (
      <Link href={href} aria-current={active ? "page" : undefined}
        className={`m-1 flex flex-col items-center justify-center rounded-full py-2.5 text-[11px] font-medium transition ${active ? "bg-navy/10 text-heading" : "text-ink-mute"}`}>
        {children}
      </Link>
    );
  }
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`block rounded-xl px-3 py-2 text-[14px] transition ${active ? "bg-card text-heading font-medium shadow-[0_1px_2px_rgb(0_0_0/0.05),0_6px_16px_-10px_rgb(0_0_0/0.25)]" : "text-ink-soft hover:text-ink hover:bg-ink/[0.04]"}`}>
      {children}
    </Link>
  );
}
