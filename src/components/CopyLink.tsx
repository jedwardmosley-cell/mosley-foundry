"use client";
import { useState } from "react";

/** A button that copies a link, for calendar apps that ask you to paste one. */
export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-quiet !px-4 !py-2 text-sm"
      onClick={async () => {
        try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 2000); } catch { window.prompt("Copy this link", url); }
      }}
    >
      {done ? "Copied" : "Copy link"}
    </button>
  );
}
