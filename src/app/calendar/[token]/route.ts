import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { calendarFor, coachCalendarFor } from "@/lib/calendarFeed";

export const dynamic = "force-dynamic";

/**
 * A private calendar link: /calendar/<token>.ics. A client's holds their routines and sessions; a coach's holds
 * the sessions they run.
 * Calendar apps can't sign in, so the long random token is the key. A wrong or retired token gets a plain 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const raw = (await params).token.replace(/\.ics$/, "");
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(raw)) return notFound();
  const profile = await db.profile.findFirst({ where: { calendarToken: raw }, select: { userId: true, user: { select: { role: true } } } });
  let body: string;
  if (profile?.user.role === "PARTICIPANT") body = await calendarFor(profile.userId, appUrl());
  else {
    const coach = await db.user.findFirst({ where: { calendarToken: raw, status: "ACTIVE", OR: [{ role: "COACH" }, { role: "ADMIN", alsoCoach: true }] }, select: { id: true } });
    if (!coach) return notFound();
    body = await coachCalendarFor(coach.id, appUrl());
  }
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
