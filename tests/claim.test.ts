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
