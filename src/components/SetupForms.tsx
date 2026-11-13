"use client";
import { useActionState } from "react";
import { createFirstAdmin, uploadContent, type SetupState } from "@/app/actions/setup";

function Msg({ s }: { s: SetupState }) {
  if (s?.error) return <p role="alert" className="text-sm text-alert">{s.error}</p>;
  if (s?.ok) return <p role="status" className="text-sm text-link">{s.ok}</p>;
  return null;
}

export function AdminForm() {
  const [s, action, pending] = useActionState<SetupState, FormData>(createFirstAdmin, undefined);
  return (
    <form action={action} className="space-y-3" key={s?.error ?? "new"}>
      <label className="block"><span className="label">Setup token</span><input name="token" type="password" required className="input" /></label>
      <label className="block"><span className="label">Organization name</span><input name="org" required className="input" defaultValue={s?.values?.org ?? "Mosley Foundry"} /></label>
      <label className="block"><span className="label">Your name</span><input name="name" required className="input" autoComplete="name" defaultValue={s?.values?.name} /></label>
      <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="email" defaultValue={s?.values?.email} /></label>
      <label className="block"><span className="label">Password</span><input name="password" type="password" minLength={12} required className="input" autoComplete="new-password" /><span className="text-xs text-ink-mute">At least 12 characters.</span></label>
      <Msg s={s} />
      <button className="btn-primary" disabled={pending}>{pending ? "Creating..." : "Create administrator"}</button>
    </form>
  );
}

export function ContentForm() {
  const [s, action, pending] = useActionState<SetupState, FormData>(uploadContent, undefined);
  return (
    <form action={action} className="space-y-3">
      <label className="block"><span className="label">Setup token</span><input name="token" type="password" required className="input" /></label>
      <label className="block"><span className="label">pack.json (book and workbook)</span><input name="pack" type="file" accept="application/json,.json" className="block text-sm" /></label>
      <label className="block"><span className="label">entrepreneur.json (FORGE Worksheet for Entrepreneurs)</span><input name="entrepreneur" type="file" accept="application/json,.json" className="block text-sm" /></label>
      <Msg s={s} />
      <button className="btn-primary" disabled={pending}>{pending ? "Uploading..." : "Install content"}</button>
    </form>
  );
}
