import "server-only";
import { db } from "./db";
import { isZone } from "./zone";

/** The person's saved time zone: a client's lives on their profile (for reminders), everyone else's on the account. */
export async function zoneOf(u: { id: string; role: string }): Promise<string> {
  if (u.role === "PARTICIPANT") return (await db.profile.findUnique({ where: { userId: u.id }, select: { timezone: true } }))?.timezone ?? "";
  return (await db.user.findUnique({ where: { id: u.id }, select: { timezone: true } }))?.timezone ?? "";
}

export async function saveZone(u: { id: string; role: string }, tz: string) {
  if (!isZone(tz)) return;
  if (u.role === "PARTICIPANT") await db.profile.updateMany({ where: { userId: u.id, timezone: { not: tz } }, data: { timezone: tz } });
  else await db.user.updateMany({ where: { id: u.id, timezone: { not: tz } }, data: { timezone: tz } });
}

/** The zone a form was filled in: the browser's when it came with the form (and it's saved), otherwise the saved one. */
export async function formZone(u: { id: string; role: string }, fd: FormData): Promise<string> {
  const sent = String(fd.get("timezone") ?? "");
  if (isZone(sent)) { await saveZone(u, sent); return sent; }
  return zoneOf(u);
}
