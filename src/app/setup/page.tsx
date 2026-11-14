import Link from "next/link";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { AdminForm, ContentForm } from "@/components/SetupForms";

export const metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

function Row({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-full text-[11px] flex items-center justify-center ${ok ? "bg-navy text-white" : "border border-alert text-alert"}`}>{ok ? "✓" : "!"}</span>
      <span><span className="text-[15px]">{label}</span>{hint && <span className="block text-xs text-ink-mute">{hint}</span>}</span>
    </li>
  );
}

export default async function SetupPage() {
  const tokenSet = (process.env.SETUP_TOKEN ?? "").length >= 16;
  let dbOk = true, hasAdmin = false;
  try {
    hasAdmin = (await db.user.count({ where: { role: "ADMIN", isDemo: false } })) > 0;
  } catch {
    dbOk = false;
  }
  const content = dbOk ? (await getContent()).pack.kind === "licensed" : false;
  const ai = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <p className="eyebrow">Both Hands on the Wheel</p>
      <h1 className="h1 mt-2">Launch checklist</h1>
      <ul className="card mt-6 !py-3 divide-y divide-line">
        <Row ok={dbOk} label="Database connected" hint={dbOk ? undefined : "Check DATABASE_URL in your hosting settings."} />
        <Row ok={tokenSet} label="Setup token configured" hint={tokenSet ? undefined : "Add SETUP_TOKEN (16+ characters) in your hosting settings, then redeploy."} />
        <Row ok={hasAdmin} label="Administrator account created" />
        <Row ok={content} label="Licensed content pack installed" hint={content ? undefined : "Until then the app shows a draft placeholder assessment."} />
        <Row ok={ai} label="AI companion key configured" hint={ai ? undefined : "Optional. Add ANTHROPIC_API_KEY to turn on the companion."} />
      </ul>

      {dbOk && tokenSet && !hasAdmin && (
        <section className="card mt-6">
          <h2 className="h2">1. Create the administrator</h2>
          <p className="text-sm muted mt-1 mb-4">This only works once. After this, add coaches and participants from the admin screens.</p>
          <AdminForm />
        </section>
      )}
      {dbOk && tokenSet && (
        <section className="card mt-6">
          <h2 className="h2">{hasAdmin ? "Content pack" : "2. Install the content pack"}</h2>
          <p className="text-sm muted mt-1 mb-4">Upload the files you received. You can upload one at a time. They are stored in your private database, never in the public code repository. Uploading again replaces them.</p>
          <ContentForm />
        </section>
      )}
      {hasAdmin && <p className="mt-6 text-sm"><Link href="/login" className="btn-link">Go to sign in</Link></p>}
    </main>
  );
}
