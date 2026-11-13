import { AuthForm } from "@/components/AuthForm";
import { db } from "@/lib/db";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  const demo = (await db.user.count({ where: { isDemo: true } }).catch(() => 0)) > 0;
  return (
    <>
      {reset && <p role="status" className="mb-5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-link">Your password is changed. Sign in with the new one.</p>}
      <AuthForm mode="login" next={next} />
      {demo && <div className="mt-10 rounded-xl border border-line bg-card p-4 text-[13px] text-ink-soft">
        <p className="font-medium text-ink">Demo accounts (fictional people)</p>
        <p className="mt-1">Password for all: <code>demo-password-1</code></p>
        <ul className="mt-2 space-y-0.5">
          <li>dana@demo.bothhands.app (participant, Leading Others)</li>
          <li>marcus@demo.bothhands.app (participant, Entrepreneurial)</li>
          <li>coach@demo.bothhands.app (coach)</li>
          <li>admin@demo.bothhands.app (program admin)</li>
        </ul>
      </div>}
    </>
  );
}
