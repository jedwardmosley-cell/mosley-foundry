import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Accounts created with a temporary password must set their own before using the app.
  if (user.mustChangePassword) redirect("/account/password");
  return <Shell user={user}>{children}</Shell>;
}
