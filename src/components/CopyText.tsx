"use client";
import { useState } from "react";

/** A message the coach sends themselves: share it from their phone, or copy it on a computer. */
export function CopyText({ text, label = "Copy or share" }: { text: string; label?: string }) {
  const [done, setDone] = useState("");
  const go = async () => {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setDone("Copied.");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setDone("Select the text and copy it.");
    }
  };
  return (
    <span className="inline-flex items-center gap-3">
      <button type="button" onClick={go} className="btn-quiet !py-1.5 text-sm">{label}</button>
      {done && <span role="status" className="text-sm text-ink-mute">{done}</span>}
    </span>
  );
}
