import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { validTimezone } from "@/lib/reminders";

/**
 * Records the signed-in client's time zone from their browser, so email reminders arrive at their local time.
 * A plain request (not a server action) so it never disturbs a page that is still finishing a redirect.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return new Response(null, { status: 403 });
  const u = await getCurrentUser();
  if (!u || u.role !== "PARTICIPANT") return new Response(null, { status: 401 });
  const { timezone } = (await req.json().catch(() => ({}))) as { timezone?: unknown };
  if (typeof timezone !== "string" || !validTimezone(timezone)) return new Response(null, { status: 400 });
  await db.profile.updateMany({ where: { userId: u.id, timezone: { not: timezone } }, data: { timezone } });
  return new Response(null, { status: 204 });
}
