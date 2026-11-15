import { test } from "node:test";
import assert from "node:assert/strict";
import { toClaim } from "../src/lib/claim";

test("identity statements are saved as present-tense I am claims", () => {
  assert.equal(toClaim("a leader who operates with integrity"), "I am a leader who operates with integrity");
  assert.equal(toClaim("A leader who operates with integrity"), "I am a leader who operates with integrity");
  assert.equal(toClaim("I am a calm decision maker"), "I am a calm decision maker");
  assert.equal(toClaim("I'm the one who follows through"), "I am the one who follows through");
  assert.equal(toClaim("  Jason, a builder "), "I am Jason, a builder");
});

import { withPrefix, afterPrefix, combineLines } from "../src/content/forgeLines";

test("FORGE lines keep their I am and I do starts", () => {
  assert.equal(withPrefix("I notice", "when someone goes quiet"), "I notice when someone goes quiet");
  assert.equal(withPrefix("I notice", "I notice when someone goes quiet"), "I notice when someone goes quiet");
  assert.equal(withPrefix("When", "Fear shows up, I act anyway"), "When fear shows up, I act anyway");
  assert.equal(withPrefix("I am", "I'm a leader"), "I am a leader");
  assert.equal(withPrefix("", "I serve my team because they matter."), "I serve my team because they matter.");
  assert.equal(withPrefix("I practice", "  "), "");
  assert.equal(afterPrefix("I practice", "I practice one coaching talk"), "one coaching talk");
  assert.equal(afterPrefix("I am", "A manager my team trusts"), null, "an older answer is shown whole");
  assert.equal(combineLines({ destination: "I am a leader", why: "I serve my team because they deserve it." }), "I am a leader. I serve my team because they deserve it.");
});

import { todayHeadline } from "../src/lib/todayHeadline";

test("the Today headline says where you are, with no counts or praise", () => {
  assert.equal(todayHeadline({ cycle: false, finished: false, day: 0 }).mood, "ready");
  assert.equal(todayHeadline({ cycle: true, finished: true, day: 30 }).mood, "decide");
  const mid = todayHeadline({ cycle: true, finished: false, day: 12 });
  assert.equal(mid.title, "Day 12 of 30.");
  assert.doesNotMatch(`${mid.label} ${mid.title} ${mid.line}`, /\d+ of the last|keep it going|showing up|streak/i, "no counts or praise");
});
