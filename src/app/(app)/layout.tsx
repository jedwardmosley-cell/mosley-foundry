import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { JourneyBar } from "@/components/JourneyBar";
import { getJourney, JOURNEY_STEPS } from "@/lib/journey";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Accounts created with a temporary password must set their own before using the app.
  if (user.mustChangePassword) redirect("/account/password");
  const journey = user.role === "PARTICIPANT" ? await getJourney(user.id) : null;
  // Administrators see new sign-ups at the top of every page until they act on them.
  const waiting = user.role === "ADMIN" ? await db.user.count({ where: { status: "PENDING", isDemo: false, OR: [{ orgId: null }, { orgId: user.orgId ?? "__none__" }] } }) : 0;
  return (
    <Shell user={user} journey={waiting > 0 ? (
      <Link href="/admin/people" className="mb-6 flex items-center justify-between gap-3 border-l-4 border-gold bg-gold-soft px-4 py-3 text-[15px] text-ink transition hover:text-link">
        <span><span className="font-bold text-heading">{waiting} new {waiting === 1 ? "sign-up is" : "sign-ups are"} waiting.</span> Approve, decline or delete.</span>
        <span className="shrink-0 text-sm btn-link">Review</span>
      </Link>
    ) : journey && <JourneyBar steps={JOURNEY_STEPS.map((s) => ({ ...s }))} done={journey.done} current={journey.current} cycle={journey.cycle} identityMissing={journey.identityMissing} roadMissing={journey.roadMissing} lookedBack={journey.lookedBack} />}>
      {children}
    </Shell>
  );
}
