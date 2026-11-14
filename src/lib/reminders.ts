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

// ---------- The weekly plan email ----------

/** When the weekly email goes out, in the client's local time. */
export const WEEKLY_SLOTS = {
  SUN_PM: { label: "Sunday evening (6 pm)", dow: 0, minutes: 18 * 60, startsTomorrow: true },
  MON_AM: { label: "Monday morning (7 am)", dow: 1, minutes: 7 * 60, startsTomorrow: false },
} as const;
export type WeeklySlot = keyof typeof WEEKLY_SLOTS;

type WeeklyProfile = { weeklyOn: boolean; weeklySlot: string; timezone: string; lastWeeklyOn: string };

/** Whether the weekly email is due now. Same rules as the daily one: once, on time, never hours late. */
export function weeklyDue(p: WeeklyProfile, now = new Date()): { due: false } | { due: true; ymd: string } {
  if (!p.weeklyOn || !validTimezone(p.timezone)) return { due: false };
  const slot = WEEKLY_SLOTS[p.weeklySlot as WeeklySlot] ?? WEEKLY_SLOTS.SUN_PM;
  const local = localNow(p.timezone, now);
  if (p.lastWeeklyOn === local.ymd || local.dow !== slot.dow) return { due: false };
  const late = local.minutes - slot.minutes;
  if (late < 0 || late > REMINDER_WINDOW_MINUTES) return { due: false };
  return { due: true, ymd: local.ymd };
}

export type WeeklyDigest = {
  name: string;
  /** e.g. "Week 2 of 30: Interrupt It" and that week's look-back question. */
  cycle?: { heading: string; question?: string } | null;
  routines: { title: string; when: string }[];
  people: { name: string; when: string }[];
  session?: string | null;
  appUrl: string;
};

/** The weekly email. Routine titles and names are the client's own; it never includes the plan, reflections, scores or feedback. */
export function weeklyEmail(d: WeeklyDigest) {
  const first = d.name.split(" ")[0];
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const blocks: { title: string; lines: string[] }[] = [];
  if (d.cycle) blocks.push({ title: d.cycle.heading, lines: d.cycle.question ? [`This week's question: ${d.cycle.question}`] : [] });
  if (d.routines.length) blocks.push({ title: "Your routines", lines: d.routines.map((r) => `${r.title}${r.when ? ` (${r.when})` : ""}`) });
  if (d.people.length) blocks.push({ title: "Check-ins due", lines: d.people.map((p) => `${p.name}, ${p.when}`) });
  if (d.session) blocks.push({ title: "Coaching", lines: [d.session] });
  if (!blocks.length) blocks.push({ title: "A clear week", lines: ["Nothing is scheduled yet. Add a routine on My road, or start 30 days on one change."] });

  const text = [
    `Hi ${first},`,
    "Here's what's on your road this week.",
    ...blocks.map((b) => [b.title, ...b.lines.map((l) => `- ${l}`)].join("\n")),
    `Look back and plan the week: ${d.appUrl}/reflect`,
    `You get this once a week. Change the day or turn it off in Settings: ${d.appUrl}/settings`,
  ].join("\n\n");

  const html = `<div style="font-family:Georgia,serif;color:#131F35;max-width:560px;line-height:1.5">
<p>Hi ${e(first)},</p>
<p>Here's what's on your road this week.</p>
${blocks.map((b) => `<h3 style="font-family:Arial,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#A35409;margin:24px 0 6px">${e(b.title)}</h3>
${b.lines.length ? `<ul style="margin:0;padding-left:20px">${b.lines.map((l) => `<li>${e(l)}</li>`).join("")}</ul>` : ""}`).join("\n")}
<p style="margin-top:28px"><a href="${d.appUrl}/reflect" style="display:inline-block;background:#1E2F4A;color:#FBF8F2;padding:10px 20px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif">Look back and plan the week</a></p>
<p style="font-family:Arial,sans-serif;font-size:13px;color:#6E7480">You get this once a week. <a href="${d.appUrl}/settings" style="color:#6E7480">Change the day or turn it off in Settings.</a></p>
</div>`;
  return { subject: "Your week ahead", text, html };
}
