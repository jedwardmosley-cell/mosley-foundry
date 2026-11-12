import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCoachReply } from "../src/lib/ai";
import { FORGE_LINES, PRACTICE_STARTERS } from "../src/content/forgeLines";

test("the identity coach's answer is read safely", () => {
  const r = parseCoachReply('Here you go: {"kind":"habit","note":"That is a habit — a good one.","question":"What does it say about you?","suggestion":"I am a person who honors my health."}');
  assert.equal(r?.kind, "habit");
  assert.equal(r?.note, "That is a habit, a good one.");
  assert.equal(r?.suggestion, "I am a person who honors my health.");
  assert.equal(parseCoachReply("no json here"), null);
  assert.equal(parseCoachReply('{"kind":"other","note":"x"}')?.kind, "identity");
});

test("FORGE statements are identities, and practices live in Discipline by Design", () => {
  for (const l of FORGE_LINES) {
    assert.equal(l.prefix, "I am", `${l.pillar} starts with I am`);
    for (const list of Object.values(l.starters)) for (const s of list) {
      assert.ok(!/^(planning|keeping|asking|writing|handing|reviewing|one |when )/i.test(s), `${l.pillar} starter reads like a habit: ${s}`);
    }
    assert.ok(Object.values(PRACTICE_STARTERS[l.pillar]).every((x) => x.length > 0), `${l.pillar} has practices for the Blueprint`);
  }
});
