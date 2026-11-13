"use client";
import { useActionState } from "react";
import Link from "next/link";
import { changePassword, type PasswordState } from "@/app/actions/auth";

export function PasswordForm({ first }: { first: boolean }) {
  const [s, action, pending] = useActionState<PasswordState, FormData>(changePassword, undefined);
  if (s?.ok) {
    return (
      <div>
        <p role="status" className="text-link">Your password is changed. Other devices have been signed out.</p>
        <Link href="/" className="btn-primary mt-4">Continue</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">{first ? "Temporary password" : "Current password"}</span>
        <input name="current" type="password" required autoComplete="current-password" className="input" />
      </label>
      <label className="block">
        <span className="label">New password</span>
        <input name="next" type="password" required minLength={10} autoComplete="new-password" className="input" />
        <span className="mt-1 block text-xs text-ink-mute">At least 10 characters.</span>
      </label>
      <label className="block">
        <span className="label">New password again</span>
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className="input" />
      </label>
      {s?.error && <p role="alert" className="text-sm text-alert">{s.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Change password"}</button>
    </form>
  );
}
