/**
 * My focus: one or two development opportunities, and that's it.
 * The goal is a 5 on every rule. Two focuses share one check-in row a day.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lowestRule, freeSlot, statusFor, focusTitle, MAX_FOCUSES } from "../src/lib/focus";

const a = (f: number, o: number, r: number, g: number, e: number, rev: Partial<Record<"revisedF" | "revisedO" | "revisedR" | "revisedG" | "revisedE", number>> = {}) => ({ f, o, r, g, e, ...rev });

test("focus ideas start from the lowest score; nothing is labeled a weakness", () => {
  assert.equal(lowestRule(a(4, 3, 4, 3, 2)), "E");
  assert.equal(lowestRule(a(4, 2, 4, 3, 2)), "O", "a tie takes the first in FORGE order");
  assert.equal(lowestRule(a(4, 3, 4, 3, 2, { revisedE: 5 })), "O", "revised scores count");
  assert.equal(lowestRule(null), null);
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
