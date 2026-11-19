/**
 * Wall-clock times in a named time zone. A coach types "Tuesday 10:00" meaning their own 10:00, and each person
 * sees a session in their own zone. Works with any IANA name (America/Chicago); falls back to the server's zone
 * when none is known.
 */
export function isZone(tz: string | null | undefined): tz is string {
  if (!tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

function parts(d: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { y: g("year"), mo: g("month"), d: g("day"), h: g("hour") % 24, mi: g("minute"), s: g("second") };
}

/** How far the zone is ahead of UTC at that moment, in milliseconds. */
function offset(tz: string, at: Date) {
  const x = parts(at, tz);
  return Date.UTC(x.y, x.mo - 1, x.d, x.h, x.mi, x.s) - Math.floor(at.getTime() / 1000) * 1000;
}

/** "2026-11-24T10:00" read as that time in the zone. Null when it isn't a date and time. */
export function fromWallTime(local: string, tz?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local.trim());
  if (!m) return null;
  if (!isZone(tz)) { const d = new Date(local); return isNaN(+d) ? null : d; }
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes settle the offset on either side of a clock change.
  let t = guess - offset(tz, new Date(guess));
  t = guess - offset(tz, new Date(t));
  return new Date(t);
}

/** The value a datetime-local box expects, in the zone. */
export function toWallTime(d: Date, tz?: string | null): string {
  const p = (n: number) => String(n).padStart(2, "0");
  if (!isZone(tz)) return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  const x = parts(d, tz);
  return `${x.y}-${p(x.mo)}-${p(x.d)}T${p(x.h)}:${p(x.mi)}`;
}

/** Today's date in the zone, as YYYY-MM-DD, with the weekday. */
export function todayIn(tz?: string | null, now = new Date()) {
  const wall = toWallTime(now, tz);
  const weekday = now.toLocaleDateString("en-US", { weekday: "long", ...(isZone(tz) ? { timeZone: tz } : {}) });
  return { date: wall.slice(0, 10), weekday };
}

/** A session's day and time. */
export const SESSION_TIME: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };

/** A date shown in the zone. A time of day also says which zone, like "10:00 AM CST". */
export function fmtIn(d: Date, tz: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  if (!isZone(tz)) return d.toLocaleString("en-US", opts);
  return d.toLocaleString("en-US", { ...opts, timeZone: tz, ...(opts.hour ? { timeZoneName: "short" } : {}) });
}
