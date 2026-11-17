/**
 * Set the Tone: closed-door phrases are found by rule, distress stops the coaching,
 * and the coach's reading is kept only when it is well formed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findClosedDoors, tally, soundsLikeDistress } from "../src/lib/tone";
import { parseToneReading } from "../src/lib/ai";

test("closed-door phrases are found as written, in order", () => {
  const hits = findClosedDoors("I can't run this meeting. That's just how I am, I'm not good at conflict. I don't know how to fix it.");
  assert.deepEqual(hits.map((h) => h.label), ["I can't", "that's just how I am", "I'm not good at", "I don't know how"]);
  assert.equal(hits[0].said, "I can't");
  assert.deepEqual(findClosedDoors("I cant do it and i cannot stop").map((h) => h.label), ["I can't", "I can't"], "spelling and case vary");
});

test("open-door language is left alone", () => {
  assert.deepEqual(findClosedDoors("I haven't run a meeting like this yet. I never give up. I know how to ask for help."), []);
  assert.deepEqual(findClosedDoors("I can do hard things"), []);
});

test("the audit counts each phrase, most often first", () => {
  const t = tally(findClosedDoors("I can't. I can't. There's no way. Why bother."));
  assert.deepEqual(t[0], { label: "I can't", count: 2 });
  assert.equal(t.length, 3);
});

test("words that sound like real distress stop the coaching", () => {
  assert.ok(soundsLikeDistress("Some days I want to die"));
  assert.ok(soundsLikeDistress("they'd be better off without me"));
  assert.ok(soundsLikeDistress("thinking about self-harm again"));
  assert.ok(!soundsLikeDistress("this deadline is killing me"));
  assert.ok(!soundsLikeDistress("I can't do this meeting"));
});

test("the coach's reading keeps only well-formed parts", () => {
  const r = parseToneReading(`Here you go: {"summary": "You expect to fail — before it starts.", "lines": [{"rule": "E", "fit": "pulls", "note": "Calm one vs about to lose it."}, {"rule": "X", "fit": "pulls", "note": "bad rule"}],
    "doors": [{"said": "I can't", "truer": "I haven't yet"}, {"said": "", "truer": "dropped"}],
    "chain": {"thought": "they won't listen", "words": "I can't", "feeling": "tense", "action": "go quiet", "stepIn": "Catch the thought."},
    "keep": {"kind": "CONFIRM", "text": "I am the calm one in the room."}}`);
  assert.ok(r);
  assert.equal(r!.summary, "You expect to fail, before it starts.", "no em dashes");
  assert.deepEqual(r!.lines.map((l) => l.rule), ["E"], "unknown rules are dropped");
  assert.equal(r!.doors.length, 1, "empty doors are dropped");
  assert.equal(r!.keep?.kind, "CONFIRM");
  assert.equal(parseToneReading('{"keep": {"kind": "PRAISE", "text": "x"}}')?.keep, null, "only claim, confirm or condemn");
  assert.equal(parseToneReading("not json"), null);
});
