import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function Home() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.role === "COACH") redirect("/coach");
  if (u.role === "ADMIN") redirect("/admin");
  const p = await db.profile.findUnique({ where: { userId: u.id } });
  redirect(p?.onboardedAt ? "/dashboard" : "/onboarding");
}
