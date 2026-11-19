/** Session times: what a coach types is their own wall-clock time, and each person sees it in theirs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fromWallTime, toWallTime, fmtIn, todayIn, isZone } from "../src/lib/zone";

test("10:00 typed in Chicago is 10:00 in Chicago, whatever the server's zone", () => {
  const d = fromWallTime("2026-11-24T10:00", "America/Chicago")!;
  assert.equal(d.toISOString(), "2026-11-24T16:00:00.000Z", "CST is UTC-6");
  assert.equal(toWallTime(d, "America/Chicago"), "2026-11-24T10:00");
  assert.equal(toWallTime(d, "America/New_York"), "2026-11-24T11:00");
});

test("summer time is read correctly too", () => {
  assert.equal(fromWallTime("2026-07-07T09:30", "America/New_York")!.toISOString(), "2026-07-07T13:30:00.000Z", "EDT is UTC-4");
  assert.equal(fromWallTime("2026-07-07T09:30", "Europe/London")!.toISOString(), "2026-07-07T08:30:00.000Z", "BST is UTC+1");
});

test("the days the clocks change", () => {
  // US clocks go back on Nov 1, 2026 and forward on Mar 8, 2026.
  assert.equal(fromWallTime("2026-11-01T12:00", "America/New_York")!.toISOString(), "2026-11-01T17:00:00.000Z");
  assert.equal(fromWallTime("2026-03-08T12:00", "America/New_York")!.toISOString(), "2026-03-08T16:00:00.000Z");
  assert.equal(fromWallTime("2026-10-31T12:00", "America/New_York")!.toISOString(), "2026-10-31T16:00:00.000Z");
});

test("a time shown with its zone, and a plain date without one", () => {
  const d = new Date("2026-11-24T16:00:00Z");
  assert.equal(fmtIn(d, "America/Chicago", { hour: "numeric", minute: "2-digit" }), "10:00 AM CST");
  assert.equal(fmtIn(d, "Asia/Tokyo", { month: "short", day: "numeric" }), "Nov 25");
});

test("no zone known, or nonsense, falls back without breaking", () => {
  assert.equal(isZone("Not/AZone"), false);
  assert.ok(fromWallTime("2026-11-24T10:00", "Not/AZone"));
  assert.equal(fromWallTime("next Tuesday", "America/Chicago"), null);
});

test("today is the coach's today", () => {
  const late = new Date("2026-11-25T03:00:00Z"); // still Nov 24 in Chicago
  assert.deepEqual(todayIn("America/Chicago", late), { date: "2026-11-24", weekday: "Tuesday" });
  assert.deepEqual(todayIn("Asia/Tokyo", late), { date: "2026-11-25", weekday: "Wednesday" });
});
