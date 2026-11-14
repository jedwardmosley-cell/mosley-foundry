import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, cleanPack } from "../src/content/clean";
import { publicPack } from "../src/content/public-pack";

test("Ed's name and Ed's mentor are cleaned out of book text", () => {
  assert.equal(cleanText("Ed watches two consultants. They own it."), "A leader watches two consultants. They own it.");
  assert.equal(cleanText("The executive Ed coaches has quiet turnover."), "The executive has quiet turnover.");
  assert.equal(cleanText("the person I am building up, whose potential I see the way Ed's mentor saw his"), "the person I am building up");
  assert.equal(
    cleanText("A life built around growth needs people built around growth. Ed's mentor spent thirty seconds saying something true. Someone did that for you. Do it for someone else."),
    "A life built around growth needs people built around growth.",
  );
  assert.equal(cleanText("Ed at the Insurance Company"), "The Leader at the Insurance Company");
  assert.equal(cleanText("Edward and Eddie stay."), "Edward and Eddie stay.", "only the name Ed");
});

test("the lesson about Ed's mentor is left out", () => {
  const p = cleanPack({ ...publicPack, edsLessons: [{ chapter: "c", title: "The Mentor", setup: "Ed's mentor changed his life.", prompts: [] }, { chapter: "c", title: "The Staring Problem", setup: "Ed stumbles.", prompts: [] }] });
  assert.deepEqual(p.edsLessons.map((e) => e.title), ["The Staring Problem"]);
  assert.equal(p.edsLessons[0].setup, "A leader stumbles.");
});
