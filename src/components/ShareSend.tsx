"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markShared } from "@/app/actions/weekOne";

type Kind = "plan" | "mentee" | "week2" | "week3" | "week4" | "day30";

/**
 * Sends a message from the client's own phone: the share sheet (Messages, Mail and the rest), or
 * an email on a computer. The other person doesn't need the app. The app records the tap.
 */
export function ShareSend({ message, to, email, kind, toggles, doneHref, label = "Send by text or email", className = "btn-primary", disabled }: {
  message: string; to: string; email?: string | null; kind: Kind; toggles?: { feeling: boolean; old: boolean; gap: boolean };
  doneHref?: string; label?: string; className?: string; disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setError(null);
    const text = message.trim();
    if (!text) return setError("Write a message first.");
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return; // closed the share sheet without sending
      }
    } else {
      window.location.href = `mailto:${email ?? ""}?subject=${encodeURIComponent("What I'm working on")}&body=${encodeURIComponent(text)}`;
    }
    start(async () => {
      const r = await markShared({ kind, to, ...(toggles ?? {}) });
      if ("error" in r) return setError(r.error);
      if (doneHref) router.push(doneHref);
      else router.refresh();
    });
  };
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={send} disabled={disabled || pending} className={className}>{pending ? "Saving..." : label}</button>
      {error && <span role="alert" className="mt-1 text-sm text-alert">{error}</span>}
    </span>
  );
}
