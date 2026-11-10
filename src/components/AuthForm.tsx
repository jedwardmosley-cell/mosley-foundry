"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signIn, signUp, type AuthState } from "@/app/actions/auth";

export function AuthForm({ mode, next, invite }: { mode: "login" | "signup"; next?: string; invite?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, undefined);
  return (
    <form action={action} className="space-y-4">
      <h2 className="h2">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
      {mode === "signup" && (
        <label className="block"><span className="label">Name</span><input name="name" className="input" autoComplete="name" required /></label>
      )}
      <label className="block"><span className="label">Email</span><input name="email" type="email" className="input" autoComplete="email" required /></label>
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" className="input" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "signup" ? 10 : undefined} required />
        {mode === "signup" && <span className="mt-1 block text-xs text-ink-mute">At least 10 characters.</span>}
      </label>
      {next && <input type="hidden" name="next" value={next} />}
      {invite && <input type="hidden" name="invite" value={invite} />}
      {state?.error && <p role="alert" className="text-sm text-clay">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "One moment..." : mode === "login" ? "Sign in" : "Create account"}</button>
      <p className="text-sm muted text-center">
        {mode === "login" ? <>New here? <Link className="btn-link" href="/signup">Create an account</Link></> : <>Already have an account? <Link className="btn-link" href="/login">Sign in</Link></>}
      </p>
    </form>
  );
}
