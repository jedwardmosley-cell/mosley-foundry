"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPartnerSent } from "@/app/actions/partner";

/**
 * The message to the partner, as it will be sent. They can change the words; the link has to stay.
 * Sends from their own phone (the share sheet), or an email on a computer. The app records the tap.
 */
export function PartnerSend({ partnerId, message, email, label = "Send by text or email", className = "btn-primary" }: { partnerId: string; message: string; email?: string | null; label?: string; className?: string }) {
  const router = useRouter();
  const [text, setText] = useState(message);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setError(null);
    const t = text.trim();
    if (!t) return setError("Write a message first.");
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text: t });
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return; // closed the share sheet without sending
      }
    } else {
      window.location.href = `mailto:${email ?? ""}?subject=${encodeURIComponent("Your honest view")}&body=${encodeURIComponent(t)}`;
    }
    start(async () => {
      const r = await markPartnerSent({ partnerId, message: t });
      if ("error" in r) return setError(r.error);
      router.refresh();
    });
  };
  return (
    <div>
      <label htmlFor={`partner-message-${partnerId}`} className="text-sm font-medium text-heading">The text message</label>
      <textarea id={`partner-message-${partnerId}`} value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1000} className="textarea mt-1.5" />
      <div className="mt-3">
        <button type="button" onClick={send} disabled={pending} className={className}>{pending ? "Saving..." : label}</button>
        {error && <p role="alert" className="mt-1.5 text-sm text-alert">{error}</p>}
      </div>
    </div>
  );
}
