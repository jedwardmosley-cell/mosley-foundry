import Link from "next/link";
import { validResetToken } from "@/lib/resetTokens";
import { ResetForm } from "@/components/ForgotForms";

export const metadata = { title: "Pick a new password" };

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  if (!(await validResetToken(token))) {
    return (
      <div className="space-y-3">
        <h2 className="h2">This link has expired</h2>
        <p className="text-[15px]">Reset links work once and expire after an hour.</p>
        <Link href="/forgot" className="btn-primary inline-flex">Send me a new link</Link>
      </div>
    );
  }
  return <ResetForm token={token} />;
}
