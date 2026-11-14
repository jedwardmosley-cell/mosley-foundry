import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { appUrl, emailAvailable, sendEmail } from "@/lib/email";
import { reminderDue, reminderEmail, weeklyDue, weeklyEmail } from "@/lib/reminders";
import { weeklyDigestFor } from "@/lib/weekly";
import { cyclePosition } from "@/lib/cycle";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Sends the daily check-in reminders and weekly plan emails that are due. A scheduler calls this every 15 minutes
 * (.github/workflows/reminders.yml) with the CRON_SECRET. Safe to call more often: each client gets at most one a day.
 */
async function run(req: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!emailAvailable()) return Response.json({ error: "Email is not set up (RESEND_API_KEY and EMAIL_FROM)" }, { status: 503 });

  const now = new Date();
  const profiles = await db.profile.findMany({
    where: { remindersOn: true, reminderBy: { in: ["EMAIL", "BOTH"] }, timezone: { not: "" }, user: { isDemo: false, role: "PARTICIPANT" } },
    select: { userId: true, remindersOn: true, reminderBy: true, reminderTime: true, reminderDays: true, timezone: true, lastReminderOn: true, user: { select: { email: true, name: true } } },
  });
  let sent = 0;
  for (const p of profiles) {
    const r = reminderDue(p, now);
    if (!r.due) continue;
    // Claim the day first, so two runs at once can't both send.
    const claimed = await db.profile.updateMany({ where: { userId: p.userId, lastReminderOn: { not: r.ymd } }, data: { lastReminderOn: r.ymd } });
    if (!claimed.count) continue;
    if (await db.dailyCheckIn.count({ where: { userId: p.userId, date: r.ymd } })) continue;

    const localDay = new Date(`${r.ymd}T12:00:00`);
    const endOfDay = new Date(`${r.ymd}T23:59:59`);
    const [cycle, people] = await Promise.all([
      db.developmentCycle.findFirst({ where: { userId: p.userId, status: "ACTIVE" }, select: { startDate: true } }),
      db.relationship.findMany({ where: { ownerId: p.userId, active: true, nextCheckIn: { lte: endOfDay } }, select: { name: true }, orderBy: { nextCheckIn: "asc" }, take: 3 }),
    ]);
    const pos = cycle ? cyclePosition(cycle.startDate, localDay) : null;
    const msg = reminderEmail({ name: p.user.name, day: pos && !pos.finished ? pos.day : null, people: people.map((x) => x.name), appUrl: appUrl() });
    if (await sendEmail({ to: p.user.email, ...msg })) sent++;
  }
  // The weekly plan email: Sunday evening or Monday morning, the client's choice.
  const weekly = await db.profile.findMany({
    where: { weeklyOn: true, timezone: { not: "" }, user: { isDemo: false, role: "PARTICIPANT" } },
    select: { userId: true, weeklyOn: true, weeklySlot: true, timezone: true, lastWeeklyOn: true, user: { select: { email: true, name: true } } },
  });
  let weeklySent = 0;
  for (const p of weekly) {
    const r = weeklyDue(p, now);
    if (!r.due) continue;
    const claimed = await db.profile.updateMany({ where: { userId: p.userId, lastWeeklyOn: { not: r.ymd } }, data: { lastWeeklyOn: r.ymd } });
    if (!claimed.count) continue;
    const digest = await weeklyDigestFor(p.userId, p.user.name, p.timezone, p.weeklySlot, appUrl(), now);
    if (await sendEmail({ to: p.user.email, ...weeklyEmail(digest) })) weeklySent++;
  }
  return Response.json({ checked: profiles.length, sent, weeklyChecked: weekly.length, weeklySent });
}

export const GET = run;
export const POST = run;
