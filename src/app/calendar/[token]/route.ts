import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { calendarFor } from "@/lib/calendarFeed";

export const dynamic = "force-dynamic";

/**
 * The client's private calendar link: /calendar/<token>.ics.
 * Calendar apps can't sign in, so the long random token is the key. A wrong or retired token gets a plain 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const raw = (await params).token.replace(/\.ics$/, "");
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(raw)) return notFound();
  const profile = await db.profile.findFirst({ where: { calendarToken: raw }, select: { userId: true, user: { select: { role: true } } } });
  if (!profile || profile.user.role !== "PARTICIPANT") return notFound();
  const body = await calendarFor(profile.userId, appUrl());
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="both-hands.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}
