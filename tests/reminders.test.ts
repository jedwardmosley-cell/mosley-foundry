/**
 * Reminders and the calendar link: routines read their day and time (including older text-only ones),
 * the calendar file is valid, reminders are calm (one a day, the client's days and time only),
 * and nothing private reaches the calendar or the email.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { parseDays, parseTime, scheduleOf, isScheduled, daysToText } from "../src/lib/schedule";
import { buildCalendar, fold, esc, routineEvent } from "../src/lib/ics";
import { reminderDue, reminderEmail, localNow } from "../src/lib/reminders";
import { calendarFor } from "../src/lib/calendarFeed";

test("schedule: reads days and times from older text entries", () => {
  assert.deepEqual(parseDays("Sunday 7 pm"), [0]);
  assert.deepEqual(parseDays("Tuesday stand-up"), [2]);
  assert.deepEqual(parseDays("Weekdays, 6:15 am"), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseDays("Every day"), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(parseDays("Mon, Wed"), [1, 3]);
  assert.deepEqual(parseDays("Quarterly destination check"), []);
  assert.equal(parseTime("6:15 am"), "06:15");
  assert.equal(parseTime("Sunday 7 pm"), "19:00");
  assert.equal(parseTime("12 am"), "00:00");
  assert.equal(parseTime("12:30 pm"), "12:30");
  assert.equal(parseTime("19:45"), "19:45");
  assert.equal(parseTime("Before 7 am"), "", "a hedged time is not a start time");
  assert.equal(parseTime("Tuesday stand-up"), "");
  assert.equal(daysToText([1, 2, 3, 4, 5]), "Weekdays");
});

test("schedule: stored fields win over the text, and daily means every day", () => {
  assert.deepEqual(scheduleOf({ cadence: "WEEKLY", when: "Sunday 7 pm", days: "6", time: "08:00" }), { days: [6], time: "08:00" });
  assert.deepEqual(scheduleOf({ cadence: "WEEKLY", when: "Sunday 7 pm", days: "", time: "" }), { days: [0], time: "19:00" });
  assert.deepEqual(scheduleOf({ cadence: "DAILY", when: "", days: "", time: "" }).days.length, 7);
  assert.equal(isScheduled({ cadence: "WEEKLY", when: "", days: "", time: "" }), false, "a weekly routine with no day stays off the calendar");
  assert.equal(isScheduled({ cadence: "QUARTERLY", when: "", days: "", time: "", startsOn: null }), false);
});

test("calendar file: escaped, folded at 75 octets, CRLF line ends", () => {
  assert.equal(esc("a, b; c\\d\nnext"), "a\\, b\\; c\\\\d\\nnext");
  const long = "DESCRIPTION:" + "é".repeat(60);
  const folded = fold(long);
  for (const line of folded.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ""), long);
  const ics = buildCalendar("Test", [{ uid: "x@y", title: "One, two", start: { date: "20261116" } }], new Date("2026-11-14T12:00:00Z"));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261116\r\nDTEND;VALUE=DATE:20261117/);
  assert.match(ics, /SUMMARY:One\\, two/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!/[^\r]\n/.test(ics), "every line ends in CRLF");
});

test("calendar file: routines repeat on their days at their local time", () => {
  const base = { id: "r1", title: "Plan the week", detail: "", startsOn: null, createdAt: new Date(2026, 10, 10, 9) };
  const weekly = routineEvent({ ...base, cadence: "WEEKLY", when: "Sunday 7 pm", days: "", time: "" }, "https://app")!;
  assert.equal(weekly.rrule, "FREQ=WEEKLY;BYDAY=SU");
  assert.deepEqual(weekly.start, { local: "20261115T190000" }, "first Sunday on or after the day it was added, 7 pm floating time");
  const daily = routineEvent({ ...base, cadence: "DAILY", when: "", days: "", time: "06:15" }, "https://app")!;
  assert.equal(daily.rrule, "FREQ=DAILY");
  const weekdays = routineEvent({ ...base, cadence: "DAILY", when: "", days: "1,2,3,4,5", time: "06:15" }, "https://app")!;
  assert.equal(weekdays.rrule, "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
  assert.equal(routineEvent({ ...base, cadence: "WEEKLY", when: "", days: "", time: "" }, "https://app"), null);
  assert.equal(routineEvent({ ...base, cadence: "QUARTERLY", when: "Quarterly destination check", days: "", time: "" }, "https://app"), null);
});

const p = { remindersOn: true, reminderBy: "EMAIL", reminderTime: "07:30", reminderDays: "1,2,3,4,5", timezone: "America/New_York", lastReminderOn: "" };
// Monday 16 Nov 2026, 7:45 am in New York (12:45 UTC).
const monday745 = new Date("2026-11-16T12:45:00Z");

test("reminders: due once, at the client's local time, on their days only", () => {
  assert.deepEqual(localNow("America/New_York", monday745), { ymd: "2026-11-16", dow: 1, minutes: 465 });
  assert.deepEqual(reminderDue(p, monday745), { due: true, ymd: "2026-11-16" });
  assert.equal(reminderDue({ ...p, lastReminderOn: "2026-11-16" }, monday745).due, false, "never twice in one day");
  assert.equal(reminderDue(p, new Date("2026-11-16T12:15:00Z")).due, false, "not before the chosen time");
  assert.equal(reminderDue(p, new Date("2026-11-16T17:00:00Z")).due, false, "a missed run doesn't send hours late");
  assert.equal(reminderDue(p, new Date("2026-11-15T12:45:00Z")).due, false, "Sunday is not one of the chosen days");
  assert.equal(reminderDue({ ...p, remindersOn: false }, monday745).due, false);
  assert.equal(reminderDue({ ...p, reminderBy: "CALENDAR" }, monday745).due, false, "calendar-only means no email");
  assert.equal(reminderDue({ ...p, reminderBy: "BOTH" }, monday745).due, true);
  assert.equal(reminderDue({ ...p, timezone: "" }, monday745).due, false, "no email until the time zone is known");
  assert.equal(reminderDue({ ...p, timezone: "Not/AZone" }, monday745).due, false);
});

test("reminders: the email names no plan or reflection", () => {
  const m = reminderEmail({ name: "Dana Reyes", day: 10, people: ["Keisha Grant"], appUrl: "https://app" });
  assert.equal(m.subject, "Day 10 of 30: time to check in");
  assert.match(m.text, /^Hi Dana,/);
  assert.match(m.text, /a check-in with Keisha Grant/);
  assert.match(m.text, /https:\/\/app\/settings/, "every email says how to turn it off");
  assert.ok(!/pushes back|heat in my chest|pause/i.test(m.text + m.html));
  assert.match(reminderEmail({ name: "<b>x</b>", people: [], appUrl: "https://app" }).html, /Hi &lt;b&gt;x&lt;\/b&gt;,/);
});

const db = new PrismaClient();
let danaId = "";
before(async () => {
  danaId = (await db.user.findUniqueOrThrow({ where: { email: "dana@demo.bothhands.app" } })).id;
});
after(async () => {
  await db.profile.update({ where: { userId: danaId }, data: { remindersOn: false, reminderBy: "EMAIL" } });
  await db.$disconnect();
});

test("calendar link: routines, people and sessions; never the journal, plan, reflections or coach notes", async () => {
  await db.profile.update({ where: { userId: danaId }, data: { remindersOn: true, reminderBy: "CALENDAR", reminderTime: "18:00", reminderDays: "1,2,3,4,5" } });
  const ics = await calendarFor(danaId, "https://app", new Date());
  assert.match(ics, /SUMMARY:Plan the week/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=SU/);
  assert.match(ics, /SUMMARY:Check in with Keisha Grant/);
  assert.match(ics, /SUMMARY:Coaching session with Avery Lin/);
  assert.match(ics, /SUMMARY:Daily check-in/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/);
  assert.ok(!/PRIVATE DEMO JOURNAL|Coach-private|pushes back|five times out of seven|Private note/i.test(ics.replace(/\r\n /g, "")));
  await db.profile.update({ where: { userId: danaId }, data: { reminderBy: "EMAIL" } });
  assert.ok(!/SUMMARY:Daily check-in/.test(await calendarFor(danaId, "https://app")), "email-only reminders stay off the calendar");
});
