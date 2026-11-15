"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Every new screen starts at the top. Next keeps the old scroll position after a form saves and
 * moves to the next step, which left people looking at the bottom of the new page.
 */
export function ScrollTop() {
  const path = usePathname();
  const query = useSearchParams().toString();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (window.location.hash) return;
    window.scrollTo(0, 0);
  }, [path, query]);
  return null;
}
