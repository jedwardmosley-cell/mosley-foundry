/**
 * A small iCalendar (RFC 5545) writer for the client's private calendar link.
 * Routine times are "floating" (no time zone), so 7:00 am means 7:00 am wherever the client's phone is.
 * Coaching sessions are fixed moments, so they are written in UTC.
 */
import { scheduleOf } from "./schedule";

export type CalEvent = {
  uid: string;
  title: string;
  description?: string;
  url?: string;
  /** A day with no time (all day), a local time, or a fixed moment. */
  start: { date: string } | { local: string } | { utc: Date };
  minutes?: number;
  rrule?: string;
  alarm?: boolean;
};

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const pad = (n: number) => String(n).padStart(2, "0");
const dateOnly = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Escapes text for a property value. */
export function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a line at 75 octets, as the standard requires, without splitting a character. */
export function fold(line: string) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "", size = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > limit) { out.push(cur); cur = ""; size = 0; limit = 74; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function addMinutesLocal(local: string, minutes: number) {
  const d = new Date(Date.UTC(+local.slice(0, 4), +local.slice(4, 6) - 1, +local.slice(6, 8), +local.slice(9, 11), +local.slice(11, 13) + minutes));
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`;
}

export function buildCalendar(name: string, events: CalEvent[], now = new Date()): string {
  const L: string[] = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mosley Foundry//Both Hands on the Wheel//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    L.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utcStamp(now)}`, `SUMMARY:${esc(e.title)}`);
    if ("date" in e.start) {
      const d = e.start.date;
      const next = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8) + 1));
      L.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`, "TRANSP:TRANSPARENT");
    } else if ("local" in e.start) {
      L.push(`DTSTART:${e.start.local}`, `DTEND:${addMinutesLocal(e.start.local, e.minutes ?? 30)}`);
    } else {
      L.push(`DTSTART:${utcStamp(e.start.utc)}`, `DTEND:${utcStamp(new Date(e.start.utc.getTime() + (e.minutes ?? 60) * 60000))}`);
    }
    if (e.rrule) L.push(`RRULE:${e.rrule}`);
    if (e.description) L.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.url) L.push(`URL:${e.url}`);
    if (e.alarm) L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, "TRIGGER:PT0M", "END:VALARM");
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}

/** The first day on or after `from` whose weekday is in `days` (any day when `days` is empty). */
function firstOn(from: Date, days: number[]) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 7 && days.length && !days.includes(d.getDay()); i++) d.setDate(d.getDate() + 1);
  return d;
}

type Routine = { id: string; title: string; detail: string; cadence: string; when: string; days?: string; time?: string; startsOn: Date | null; createdAt: Date };

/**
 * A routine as a repeating event. Its first date is fixed (the start date, or the day it was added),
 * so the calendar sees the same event every time it refreshes. Returns null when there is nothing to schedule.
 */
export function routineEvent(c: Routine, appUrl: string): CalEvent | null {
  const { days, time } = scheduleOf(c);
  const anchor = c.startsOn ?? c.createdAt;
  let rrule: string | undefined;
  let first: Date;
  if (c.cadence === "DAILY") {
    first = firstOn(anchor, days.length === 7 ? [] : days);
    rrule = days.length === 7 || days.length === 0 ? "FREQ=DAILY" : `FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(",")}`;
  } else if (c.cadence === "WEEKLY") {
    if (!days.length && !time) return null;
    first = firstOn(anchor, days);
    rrule = `FREQ=WEEKLY;BYDAY=${(days.length ? days : [first.getDay()]).map((d) => BYDAY[d]).join(",")}`;
  } else if (c.cadence === "MONTHLY" || c.cadence === "QUARTERLY") {
    if (!c.startsOn && !time && !days.length) return null;
    first = firstOn(anchor, days.slice(0, 1));
    rrule = c.cadence === "MONTHLY" ? "FREQ=MONTHLY" : "FREQ=MONTHLY;INTERVAL=3";
  } else {
    if (!c.startsOn) return null;
    first = new Date(c.startsOn);
  }
  const date = dateOnly(first);
  return {
    uid: `routine-${c.id}@bothhands`,
    title: c.title,
    description: [c.detail, "From the Vehicle Controls in Both Hands on the Wheel."].filter(Boolean).join("\n\n"),
    url: `${appUrl}/road`,
    start: time ? { local: `${date}T${time.replace(":", "")}00` } : { date },
    minutes: 30,
    rrule,
    alarm: !!time,
  };
}

export const icsDate = dateOnly;
export const icsByDay = BYDAY;
