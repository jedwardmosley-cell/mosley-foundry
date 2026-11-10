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
        className={`flex flex-col items-center justify-center py-3 text-[12px] font-medium ${active ? "text-navy" : "text-ink-mute"}`}>
        <span className={`mb-1 h-1 w-1 rounded-full ${active ? "bg-brass" : "bg-transparent"}`} />
        {children}
      </Link>
    );
  }
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`block rounded-lg px-3 py-2 text-[14px] ${active ? "bg-paper text-navy-deep font-medium" : "text-ink-soft hover:text-ink hover:bg-paper/60"}`}>
      {children}
    </Link>
  );
}
