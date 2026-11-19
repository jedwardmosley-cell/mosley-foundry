import { getCurrentUser } from "@/lib/auth";
import { validTimezone } from "@/lib/reminders";
import { saveZone } from "@/lib/userZone";

/**
 * Records the signed-in person's time zone from their browser: a client's for reminders and session times,
 * a coach's so the times they book and see are their own.
 * A plain request (not a server action) so it never disturbs a page that is still finishing a redirect.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return new Response(null, { status: 403 });
  const u = await getCurrentUser();
  if (!u) return new Response(null, { status: 401 });
  const { timezone } = (await req.json().catch(() => ({}))) as { timezone?: unknown };
  if (typeof timezone !== "string" || !validTimezone(timezone)) return new Response(null, { status: 400 });
  await saveZone(u, timezone);
  return new Response(null, { status: 204 });
}
