/**
 * Daily check-in reminders by email. Pure helpers here; the sending happens in /api/cron/reminders.
 * Calm by design: at most one email a day, only on the days the client picked, never after they've checked in,
 * and none at all if the scheduled run was missed by more than a few hours.
 */

export const REMINDER_WINDOW_MINUTES = 180;

/** The client's local date, weekday and minutes since midnight, in their own time zone. */
export function localNow(timezone: string, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now).map((p) => [p.type, p.value]),
  );
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { ymd: `${parts.year}-${parts.month}-${parts.day}`, dow, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function validTimezone(tz: string) {
  if (!tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

type ReminderProfile = { remindersOn: boolean; reminderBy: string; reminderTime: string; reminderDays: string; timezone: string; lastReminderOn: string };

/** Whether an email reminder is due now. Returns the client's local date when it is, so the caller can mark it sent. */
export function reminderDue(p: ReminderProfile, now = new Date()): { due: false } | { due: true; ymd: string } {
  if (!p.remindersOn || !(p.reminderBy === "EMAIL" || p.reminderBy === "BOTH")) return { due: false };
  if (!validTimezone(p.timezone)) return { due: false };
  const local = localNow(p.timezone, now);
  if (p.lastReminderOn === local.ymd) return { due: false };
  if (!p.reminderDays.split(",").includes(String(local.dow))) return { due: false };
  const [h, m] = p.reminderTime.split(":").map(Number);
  const late = local.minutes - (h * 60 + m);
  if (late < 0 || late > REMINDER_WINDOW_MINUTES) return { due: false };
  return { due: true, ymd: local.ymd };
}

/** The email. It names no plan, reflection or score, since a work inbox may be seen by others. */
export function reminderEmail(o: { name: string; day?: number | null; people: string[]; appUrl: string }) {
  const first = o.name.split(" ")[0];
  const lead = o.day ? `Day ${o.day} of 30.` : "Your daily check-in is ready.";
  const people = o.people.length ? `Also due: a check-in with ${o.people.length === 1 ? o.people[0] : o.people.slice(0, -1).join(", ") + " and " + o.people.at(-1)}.` : "";
  const text = [`Hi ${first},`, `${lead} It takes a few taps: did you practice today?`, people, `Check in: ${o.appUrl}/dashboard`, `You asked for this reminder. Change the time or turn it off in Settings: ${o.appUrl}/settings`].filter(Boolean).join("\n\n");
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<div style="font-family:Georgia,serif;color:#131F35;max-width:520px;line-height:1.5">
<p>Hi ${e(first)},</p>
<p>${e(lead)} It takes a few taps: did you practice today?</p>
${people ? `<p>${e(people)}</p>` : ""}
<p><a href="${o.appUrl}/dashboard" style="display:inline-block;background:#1E2F4A;color:#FBF8F2;padding:10px 20px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif">Check in</a></p>
<p style="font-family:Arial,sans-serif;font-size:13px;color:#6E7480">You asked for this reminder. <a href="${o.appUrl}/settings" style="color:#6E7480">Change the time or turn it off in Settings.</a></p>
</div>`;
  return { subject: o.day ? `Day ${o.day} of 30: time to check in` : "Time to check in", text, html };
}
