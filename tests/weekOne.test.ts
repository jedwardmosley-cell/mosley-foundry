import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, shareMessage, weekMessage, dayThirtyMessage } from "../src/content/weekOne";

const a = { situation: "When someone pushes back on my decision in a meeting.", feeling: "Heat in my chest", oldResponse: "I defend it right away", newResponse: "I will pause and ask one question before I answer", gap: "Letting go of needing the answer" };

test("week 1: the plan reads as one sentence built from the answers", () => {
  assert.equal(buildPlan(a), "When someone pushes back on my decision in a meeting and I feel heat in my chest, I will pause and ask one question before I answer.");
  assert.equal(buildPlan({ ...a, feeling: "" }), "When someone pushes back on my decision in a meeting, I will pause and ask one question before I answer.");
  assert.equal(buildPlan({ ...a, situation: "" }), "", "no plan without a situation");
});

test("week 1: the shared message is the situation and the new response only, unless the client adds more", () => {
  const m = shareMessage(a);
  assert.equal(m, "When someone pushes back on my decision in a meeting, I'll pause and ask one question before I answer. Check on me.");
  assert.ok(!/heat|defend|letting go/i.test(m), "the feeling, the old response and the gap stay private by default");
  const all = shareMessage(a, { feeling: true, old: true, gap: true });
  assert.match(all, /heat in my chest/);
  assert.match(all, /defend it right away/);
  assert.match(all, /letting go of needing the answer/);
});

test("weeks 2 to 4 and day 30: messages are filled in from the answers", () => {
  assert.match(weekMessage(2, { real: "YES" }, a.newResponse), /^Week 2 of 30: that was the real moment\./);
  assert.match(weekMessage(3, { working: "PARTLY", gap: "SMALLER" }, a.newResponse), /Partly\. The hard part is smaller\./);
  assert.match(weekMessage(4, { keep: "A note on my laptop" }, a.newResponse), /a note on my laptop/);
  assert.match(dayThirtyMessage("I am the calm one.", 24), /I am the calm one\.\n\n30 days: I practiced 24 of them\./);
});
