"use client";
import { useActionState } from "react";
import { resetClientPassword, type ResetState } from "@/app/actions/clients";

export function ResetPasswordForm({ participantId }: { participantId: string }) {
  const [s, action, pending] = useActionState<ResetState, FormData>(resetClientPassword, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="participantId" value={participantId} />
      <p className="text-sm muted mb-2">
        Use this when a client forgets their password and asks you for help. It signs them out and gives you a temporary password to send them. They have to pick a new one when they sign in, and they are told that you reset it.
      </p>
      {s?.error && <p role="alert" className="text-sm text-alert mb-2">{s.error}</p>}
      {s?.temp ? (
        <div className="rounded-xl border border-line bg-paper p-3 text-[15px]">
          <p>New temporary password: <code className="bg-surface px-1.5 py-0.5 rounded">{s.temp}</code></p>
          <p className="mt-1 text-xs text-ink-mute">This password is shown once. Copy it and send it to your client privately.</p>
        </div>
      ) : (
        <button className="btn-quiet" disabled={pending}>{pending ? "Resetting..." : "Reset password"}</button>
      )}
    </form>
  );
}
