import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCoachReply } from "../src/lib/ai";
import { FORGE_LINES, PRACTICE_STARTERS } from "../src/content/forgeLines";
import { EXAMPLE_PEOPLE } from "../src/content/identityExamples";

test("the identity coach's answer is read safely", () => {
  const r = parseCoachReply('Here you go: {"kind":"habit","note":"That is a habit — a good one.","question":"What does it say about you?","suggestion":"I am a person who honors my health."}');
  assert.equal(r?.kind, "habit");
  assert.equal(r?.note, "That is a habit, a good one.");
  assert.equal(r?.suggestion, "I am a person who honors my health.");
  assert.equal(parseCoachReply("no json here"), null);
  assert.equal(parseCoachReply('{"kind":"other","note":"x"}')?.kind, "identity");
});

test("identity examples read as identities: I am, no schedules, no tasks, all five letters", () => {
  for (const l of FORGE_LINES) assert.equal(l.prefix, "I am", `${l.pillar} starts with I am`);
  for (const p of EXAMPLE_PEOPLE) {
    for (const s of [p.claim, ...Object.values(p.lines)]) {
      assert.ok(s.startsWith("I am "), `${p.who}: starts with I am: ${s}`);
      // test 1, could it go on a to-do list: no schedules and no task verbs
      assert.ok(!/\b(every (day|week|morning)|each (day|week)|daily|weekly|once a)\b/i.test(s), `${p.who}: reads like a schedule: ${s}`);
      assert.ok(!/^I am (planning|keeping|asking|writing|handing|reviewing|noticing|checking)\b/.test(s), `${p.who}: reads like a task: ${s}`);
    }
    assert.equal(Object.keys(p.lines).length, 5, `${p.who} has all five letters`);
  }
  for (const l of FORGE_LINES) assert.ok(Object.values(PRACTICE_STARTERS[l.pillar]).every((x) => x.length > 0), `${l.pillar} has practices for the blueprint`);
});
