import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { JourneyBar } from "@/components/JourneyBar";
import { getJourney, JOURNEY_STEPS } from "@/lib/journey";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Accounts created with a temporary password must set their own before using the app.
  if (user.mustChangePassword) redirect("/account/password");
  const journey = user.role === "PARTICIPANT" ? await getJourney(user.id) : null;
  return (
    <Shell user={user} journey={journey && <JourneyBar steps={JOURNEY_STEPS.map((s) => ({ ...s }))} done={journey.done} current={journey.current} cycle={journey.cycle} identityMissing={journey.identityMissing} />}>
      {children}
    </Shell>
  );
}
