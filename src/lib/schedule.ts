/**
 * When a routine happens: which days and what time, in the client's own local time.
 * New routines store days ("1,3,5", 0 = Sunday) and time ("18:30").
 * Older routines only have a line of text such as "Sunday 7 pm" or "Tuesday stand-up",
 * so this reads that text when the stored fields are empty. Nothing saved is changed.
 */

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

/** The day choices the routine form offers, and the days each one means. */
export const DAY_CHOICES: { label: string; days: number[] }[] = [
  { label: "", days: [] },
  { label: "Every day", days: ALL },
  { label: "Weekdays", days: WEEKDAYS },
  ...DAY_NAMES.slice(1).concat(DAY_NAMES[0]).map((n) => ({ label: n, days: [DAY_NAMES.indexOf(n)] })),
];

/** Reads days from text: "Every day", "Weekdays", "Sunday 7 pm", "Mon, Wed". Returns [] when it names none. */
export function parseDays(text: string): number[] {
  const t = ` ${text.toLowerCase()} `;
  if (/\bevery ?day\b|\bdaily\b/.test(t)) return ALL;
  if (/\bweekdays?\b/.test(t)) return WEEKDAYS;
  const found = new Set<number>();
  DAY_NAMES.forEach((n, i) => {
    const full = n.toLowerCase(), short = full.slice(0, 3);
    if (new RegExp(`\\b(${full}s?|${short})\\b`).test(t)) found.add(i);
  });
  return [...found].sort();
}

/** Reads a clock time from text: "6:15 am", "7 pm", "19:00". Returns "" when there is none, or when it is hedged ("before 7 am"). */
export function parseTime(text: string): string {
  const t = text.toLowerCase();
  if (/\b(before|after|by|around|until)\s+\d/.test(t)) return "";
  const m12 = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/);
  if (m12) {
    let h = Number(m12[1]);
    const min = Number(m12[2] ?? 0);
    if (h < 1 || h > 12 || min > 59) return "";
    const pm = m12[3].startsWith("p");
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  const m24 = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (m24) return `${m24[1].padStart(2, "0")}:${m24[2]}`;
  return "";
}

export function daysToText(days: number[]): string {
  const d = [...new Set(days)].sort();
  if (d.length === 7) return "Every day";
  if (d.join(",") === "1,2,3,4,5") return "Weekdays";
  if (d.length === 1) return DAY_NAMES[d[0]];
  return d.map((x) => SHORT[x]).join(", ");
}

export function timeToText(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** A routine's schedule: stored fields first, then the older text. */
export function scheduleOf(c: { cadence: string; when: string; days?: string; time?: string }): { days: number[]; time: string } {
  const days = c.days ? c.days.split(",").filter(Boolean).map(Number).filter((n) => n >= 0 && n <= 6) : parseDays(c.when);
  const time = c.time || parseTime(c.when);
  return { days: c.cadence === "DAILY" && days.length === 0 ? ALL : days, time };
}

/** True when the routine can go on a calendar on its own: it has a time, or a day of the week. */
export function isScheduled(c: { cadence: string; when: string; days?: string; time?: string; startsOn?: Date | null }): boolean {
  const s = scheduleOf(c);
  if (s.time) return true;
  if (c.cadence === "WEEKLY") return s.days.length > 0;
  if (c.cadence === "DAILY") return true;
  return !!c.startsOn;
}
