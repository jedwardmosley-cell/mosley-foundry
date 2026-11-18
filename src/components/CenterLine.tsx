import { addDays, ymd } from "@/lib/dates";
import { statusFor } from "@/lib/focus";

type Row = { date: string; cycleId: string | null; status: string; cycle2Id?: string | null; status2?: string };

/**
 * The center line: the 30 days as dashes on a road. Done is a full yellow dash, partial a short one,
 * "not yet" and days still ahead stay as the bare road. Today is marked in asphalt.
 * The app's one bold device, and the home of its one motion: after a check-in is saved (`justSaved`),
 * today's dash fills in.
 */
export function CenterLine({ start, day, cycleId, rows, justSaved = false, compact = false, label }: {
  start: Date; day: number; cycleId: string; rows: Row[]; justSaved?: boolean; compact?: boolean; label: string;
}) {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const row = byDate.get(ymd(addDays(start, i)));
    return { n: i + 1, status: row ? statusFor(row, cycleId) : "" };
  });
  const done = days.filter((d) => d.n <= day && (d.status === "DONE" || d.status === "PARTIAL")).length;
  const h = compact ? "h-[5px]" : "h-[7px]";
  return (
    <div role="img" aria-label={`${label}: day ${day} of 30, practiced on ${done} ${done === 1 ? "day" : "days"} so far`} className="grid grid-cols-[repeat(30,minmax(0,1fr))] items-end gap-[3px]">
      {days.map((d) => {
        const isToday = d.n === day;
        const filled = d.status === "DONE" || d.status === "PARTIAL";
        return (
          <span key={d.n} className={`relative block ${isToday ? (compact ? "h-[12px]" : "h-[18px]") : h} rounded-[1px] bg-ink/[0.10] overflow-hidden`}>
            {filled && (
              <span className={`absolute inset-x-0 bottom-0 bg-lane ${d.status === "PARTIAL" ? "w-1/2" : "w-full"} ${isToday ? h : "h-full"} ${isToday && justSaved ? "lane-fill" : ""}`} />
            )}
            {isToday && <span className={`absolute inset-x-0 top-0 bg-ink ${filled ? (compact ? "h-[7px]" : "h-[11px]") : "h-full"}`} />}
          </span>
        );
      })}
    </div>
  );
}
