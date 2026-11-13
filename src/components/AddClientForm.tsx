"use client";
import { useActionState } from "react";
import { addClient, type ClientState } from "@/app/actions/clients";

export function AddClientForm() {
  const [s, action, pending] = useActionState<ClientState, FormData>(addClient, undefined);
  return (
    <form action={action} className="space-y-3" key={s?.ok ?? s?.error ?? "new"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">Name</span><input name="name" required maxLength={120} className="input" defaultValue={s?.values?.name} /></label>
        <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" defaultValue={s?.values?.email} /></label>
      </div>
      {s?.error && <p role="alert" className="text-sm text-alert">{s.error}</p>}
      {s?.ok && <p role="status" className="text-sm text-link">{s.ok}</p>}
      {s?.temp && (
        <div className="rounded-xl border border-line bg-paper p-3 text-[15px]">
          <p>Send these sign-in details to your client privately:</p>
          <p className="mt-1">Email: <strong>{s.temp.email}</strong></p>
          <p>Temporary password: <code className="bg-surface px-1.5 py-0.5 rounded">{s.temp.password}</code></p>
          <p className="mt-1 text-xs text-ink-mute">This password is shown once. Copy it before you leave this page.</p>
        </div>
      )}
      <button className="btn-primary" disabled={pending}>{pending ? "Adding..." : "Add client"}</button>
    </form>
  );
}
