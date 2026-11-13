import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmt } from "@/lib/dates";
import { signOut } from "@/app/actions/auth";
import { PasswordForm } from "@/components/PasswordForm";

export const metadata = { title: "Change password" };

export default async function PasswordPage() {
  const u = await requireUser();
  const reset = u.mustChangePassword ? await db.user.findUnique({ where: { id: u.id }, select: { passwordResetAt: true, passwordResetBy: true } }) : null;
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <p className="eyebrow">Both Hands on the Wheel</p>
      <h1 className="h1 mt-2">{u.mustChangePassword ? "Choose your own password" : "Change password"}</h1>
      <p className="mt-3 muted text-[15px]">
        {u.mustChangePassword
          ? "You signed in with a temporary password. Pick one that only you know before you go on."
          : `Signed in as ${u.email}.`}
      </p>
      {reset?.passwordResetAt && (
        <p className="mt-4 rounded-xl border border-line bg-paper p-3 text-sm">
          Your password was reset by {reset.passwordResetBy ?? "your coach"} on {fmt(reset.passwordResetAt, { month: "long", day: "numeric", year: "numeric" })}. If you did not ask for that, tell them right away.
        </p>
      )}
      <div className="card mt-6">
        <PasswordForm first={u.mustChangePassword} />
      </div>
      <div className="mt-6 flex gap-5 text-sm">
        {!u.mustChangePassword && <Link href="/" className="btn-link">Back to the app</Link>}
        <form action={signOut}><button className="text-ink-soft hover:text-ink">Sign out</button></form>
      </div>
    </main>
  );
}
