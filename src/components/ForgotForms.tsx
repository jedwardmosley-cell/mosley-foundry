"use client";
import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, resetPasswordWithToken, type ForgotState, type AuthState } from "@/app/actions/auth";

export function ForgotForm() {
  const [s, action, pending] = useActionState<ForgotState, FormData>(requestPasswordReset, undefined);
  if (s?.sent) {
    return (
      <div className="space-y-3">
        <h2 className="h2">Check your email</h2>
        <p className="text-[15px]">If that email has an account, a link to pick a new password is on its way. It works once and expires in an hour.</p>
        <p className="text-sm muted">Nothing after a few minutes? Check your spam folder, or ask your coach to reset your password.</p>
        <Link href="/login" className="btn-link text-sm">Back to sign in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <h2 className="h2">Forgot your password?</h2>
      <p className="text-[15px] text-ink-soft">Enter your email and we&apos;ll send you a link to pick a new one.</p>
      <label className="block"><span className="label">Email</span><input name="email" type="email" className="input" autoComplete="email" required /></label>
      {s?.error && <p role="alert" className="text-sm text-alert">{s.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "One moment..." : "Send me a link"}</button>
      <p className="text-sm muted text-center"><Link className="btn-link" href="/login">Back to sign in</Link></p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [s, action, pending] = useActionState<AuthState, FormData>(resetPasswordWithToken, undefined);
  return (
    <form action={action} className="space-y-4">
      <h2 className="h2">Pick a new password</h2>
      <input type="hidden" name="token" value={token} />
      <label className="block"><span className="label">New password</span><input name="next" type="password" className="input" autoComplete="new-password" minLength={10} required /><span className="mt-1 block text-xs text-ink-mute">At least 10 characters.</span></label>
      <label className="block"><span className="label">New password again</span><input name="confirm" type="password" className="input" autoComplete="new-password" required /></label>
      {s?.error && <p role="alert" className="text-sm text-alert">{s.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving..." : "Save my new password"}</button>
    </form>
  );
}
