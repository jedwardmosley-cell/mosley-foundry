import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { acceptInvite } from "@/app/actions/participant";
import { RELATIONSHIP_ROLES } from "@/content/program";

export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rel = await db.relationship.findUnique({ where: { inviteToken: token }, include: { owner: { select: { name: true } } } });
  const u = await getCurrentUser();
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        <p className="eyebrow">Both Hands on the Wheel</p>
        {!rel || rel.inviteStatus !== "PENDING" ? (
          <p className="mt-3">This invitation is no longer active.</p>
        ) : (
          <>
            <h1 className="h2 mt-2">{rel.owner.name} named you as their {RELATIONSHIP_ROLES[rel.role as keyof typeof RELATIONSHIP_ROLES].toLowerCase()}.</h1>
            {rel.purpose && <p className="mt-3 muted">{rel.purpose}</p>}
            <p className="mt-4 text-sm text-ink-soft">Accepting connects your accounts so you both see the relationship and its check-in cadence. You will not see their assessments, reflections, journal or plan, and they will not see yours.</p>
            {u ? (
              <form action={acceptInvite} className="mt-5 flex gap-3">
                <input type="hidden" name="token" value={token} />
                <button name="decision" value="ACCEPT" className="btn-primary">Accept</button>
                <button name="decision" value="DECLINE" className="btn-quiet">Decline</button>
              </form>
            ) : (
              <div className="mt-5 flex gap-3">
                <Link href={`/signup?invite=${token}`} className="btn-primary">Create an account</Link>
                <Link href={`/login?next=/invite/${token}`} className="btn-quiet">Sign in</Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
