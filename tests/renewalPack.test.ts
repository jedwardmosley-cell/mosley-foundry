/**
 * The Renewal edition gets its own book; everyone else keeps Both Hands. Runs only where the licensed
 * files are installed (they are never in the repository).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getContent } from "../src/content";

const installed = fs.existsSync(path.join(process.cwd(), "src", "content", "licensed", "pack-renewal.json"));

test("each edition gets its own book", { skip: !installed && "Renewal book file not installed here" }, async () => {
  const renewal = (await getContent("RENEWAL")).pack;
  const both = (await getContent("BOTH_HANDS")).pack;
  assert.equal(renewal.edition, "RENEWAL");
  assert.equal(both.edition, undefined);
  assert.equal(renewal.chapters.length, 10);
  const vt = renewal.chapters.find((c) => c.title === "Vehicle Type");
  assert.ok(vt?.faithCheckIn?.verse && vt.faithCheckIn.reference, "a verse and its reference");
  assert.ok(vt.faithCheckIn.prayer.at(-1)?.startsWith("Amen"), "the prayer runs to Amen");
  assert.equal(renewal.chapters[8].pathways?.length, 10, "the Ten Pathways of Promise");
  assert.deepEqual(Object.keys(renewal.faith?.forge ?? {}), ["F", "O", "R", "G", "E"]);
  for (const k of "FORGE") assert.equal(renewal.faith!.forge[k as "F"]!.questions.length, 3, `three questions under ${k}`);
  // The same five rules and assessment as Both Hands.
  assert.deepEqual(renewal.pillars.map((p) => p.key), both.pillars.map((p) => p.key));
});

test("the no-Ed rule applies to the Renewal book too", { skip: !installed && "Renewal book file not installed here" }, async () => {
  const text = JSON.stringify((await getContent("RENEWAL")).pack.chapters);
  assert.ok(!/\bEd\b/.test(text), "Ed's name never reaches the screen");
});
