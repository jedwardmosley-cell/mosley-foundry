import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <AuthForm mode="login" next={next} />
      <div className="mt-10 rounded-xl border border-line bg-card p-4 text-[13px] text-ink-soft">
        <p className="font-medium text-ink">Demo accounts (fictional people)</p>
        <p className="mt-1">Password for all: <code>demo-password-1</code></p>
        <ul className="mt-2 space-y-0.5">
          <li>dana@demo.bothhands.app (participant, Leading Others)</li>
          <li>marcus@demo.bothhands.app (participant, Entrepreneurial)</li>
          <li>coach@demo.bothhands.app (coach)</li>
          <li>admin@demo.bothhands.app (program admin)</li>
        </ul>
      </div>
    </>
  );
}
