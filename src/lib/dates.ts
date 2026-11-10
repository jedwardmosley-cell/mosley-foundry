/** Calendar-day helpers. Dates are stored as YYYY-MM-DD strings for check-ins so a day means the participant's day. */
export function ymd(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function daysBetween(a: Date, b: Date) {
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((B.getTime() - A.getTime()) / 864e5);
}
export function mondayOf(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return ymd(x);
}
export function fmt(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00" : d) : d;
  return x.toLocaleDateString("en-US", opts);
}
