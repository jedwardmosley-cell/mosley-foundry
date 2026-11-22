/** Editions and access codes: who gets The Road to Renewal, and when a code stops working. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCode, codeProblem, editionOf } from "../src/lib/edition";

test("codes match however they're typed", () => {
  assert.equal(normalizeCode("renew-grace"), "RENEWGRACE");
  assert.equal(normalizeCode(" Renew Grace "), "RENEWGRACE");
  assert.equal(normalizeCode("RENEW_GRACE!"), "RENEWGRACE");
});

test("a code works until it is off, ended or used up", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  const ok = { active: true, expiresAt: null, maxUses: null, uses: 40 };
  assert.equal(codeProblem(ok, now), null, "no limit, no end date");
  assert.equal(codeProblem(null, now), "unknown");
  assert.equal(codeProblem({ ...ok, active: false }, now), "off");
  assert.equal(codeProblem({ ...ok, expiresAt: new Date("2026-11-21T23:59:59Z") }, now), "expired");
  assert.equal(codeProblem({ ...ok, expiresAt: new Date("2026-11-22T23:59:59Z") }, now), null, "works through its last day");
  assert.equal(codeProblem({ ...ok, maxUses: 40 }, now), "full");
  assert.equal(codeProblem({ ...ok, maxUses: 41 }, now), null);
});

test("anyone without an edition gets Both Hands on the Wheel", () => {
  assert.equal(editionOf(undefined).name, "Both Hands on the Wheel");
  assert.equal(editionOf("NOPE").key, "BOTH_HANDS");
  assert.equal(editionOf("RENEWAL").name, "The Road to Renewal");
});
