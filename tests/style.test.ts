import { test } from "node:test";
import assert from "node:assert/strict";
import { plainPunctuation, HOUSE_STYLE } from "../src/lib/ai";
import * as options from "../src/content/options";
import * as guide from "../src/content/guide";
import * as identity from "../src/content/identity";
import * as tone from "../src/lib/identityTone";
import { FORGE_LINES } from "../src/content/forgeLines";

const BANNED = /\b(steady|steadi\w*|drift\w*|rhythm\w*|navigat\w*|resonat\w*|lean into|under pressure|accumulat\w*|compound\w*|holds?|held|actually|honestly|genuinely|nobody|everybody)\b/i;

test("AI output gets straight quotes and no em dashes", () => {
  assert.equal(plainPunctuation("You said \u201Cpause\u201D \u2014 that\u2019s good."), "You said \"pause\", that's good.");
});

test("house style is part of the AI instructions", () => {
  assert.match(HOUSE_STYLE, /No em dashes/);
  assert.match(HOUSE_STYLE, /steady, drift, rhythm/);
});

test("quick-pick options and the guide follow the house style", () => {
  const all: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") all.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(options);
  walk(guide);
  walk(identity);
  walk(tone);
  walk(FORGE_LINES);
  const texts = all.filter((s) => s.includes(" "));
  assert.ok(texts.length > 50);
  for (const t of texts) {
    assert.ok(!BANNED.test(t), `banned word in: ${t}`);
    assert.ok(!/[\u2014\u201C\u201D\u2018\u2019]/.test(t), `em dash or curly quote in: ${t}`);
    assert.ok(!/, not /.test(t), `"X, not Y" pattern in: ${t}`);
  }
});
