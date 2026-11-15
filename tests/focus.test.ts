/**
 * My focus: one or two development opportunities, and that's it.
 * The watch area is awareness, never a task. Two focuses share one check-in row a day.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { watchAreas, strengths, freeSlot, statusFor, focusTitle, MAX_FOCUSES } from "../src/lib/focus";

const a = (f: number, o: number, r: number, g: number, e: number, rev: Partial<Record<"revisedF" | "revisedO" | "revisedR" | "revisedG" | "revisedE", number>> = {}) => ({ f, o, r, g, e, ...rev });

test("watch area: the lowest pillar, or the two lowest when they tie", () => {
  assert.deepEqual(watchAreas(a(4, 3, 4, 3, 2)), ["E"]);
  assert.deepEqual(watchAreas(a(4, 2, 4, 3, 2)), ["O", "E"]);
  assert.deepEqual(watchAreas(a(2, 2, 4, 3, 2)), [], "three tied lowest: nothing stands out");
  assert.deepEqual(watchAreas(a(3, 3, 3, 3, 3)), [], "all the same: none");
  assert.deepEqual(watchAreas(a(3, 3, 3, 3, 3), "G"), ["G"], "the client's pick from a tie becomes the watch area");
  assert.deepEqual(watchAreas(a(4, 3, 4, 3, 2), "G"), ["E"], "a clear lowest wins over an old pick");
  assert.deepEqual(watchAreas(a(4, 3, 4, 3, 2, { revisedE: 4 })), ["O", "G"], "revised scores count");
  assert.deepEqual(watchAreas(null), []);
});

test("strengths: the highest pillars, when they stand above the rest", () => {
  assert.deepEqual(strengths(a(4, 3, 4, 3, 2)), ["F", "R"]);
  assert.deepEqual(strengths(a(3, 3, 3, 3, 3)), []);
});

test("one or two focuses, and that's it", () => {
  assert.equal(MAX_FOCUSES, 2);
  assert.equal(freeSlot([]), 1);
  assert.equal(freeSlot([{ slot: 1 }]), 2);
  assert.equal(freeSlot([{ slot: 2 }]), 1, "when focus 1 finishes, the next one takes slot 1");
  assert.equal(freeSlot([{ slot: 1 }, { slot: 2 }]), null, "a third needs a replacement");
});

test("two focuses share a day's check-in row", () => {
  const row = { cycleId: "c1", status: "DONE", cycle2Id: "c2", status2: "PARTIAL" };
  assert.equal(statusFor(row, "c1"), "DONE");
  assert.equal(statusFor(row, "c2"), "PARTIAL");
  assert.equal(statusFor(row, "c3"), "");
  assert.equal(focusTitle({ title: "", focus: "Pause before I answer", plan: "When..." }), "Pause before I answer", "older cycles fall back to their focus");
});
