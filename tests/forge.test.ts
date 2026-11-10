import { test } from "node:test";
import assert from "node:assert/strict";
import { interpret, lowest, total, entrepreneurPatterns, isFlat } from "../src/lib/forge";
import { cyclePosition, practiceSummary } from "../src/lib/cycle";
import { publicPack } from "../src/content/public-pack";
import fs from "node:fs";

const licensed = fs.existsSync("src/content/licensed/pack.json") ? JSON.parse(fs.readFileSync("src/content/licensed/pack.json", "utf-8")) : null;
const entre = fs.existsSync("src/content/licensed/entrepreneur.json") ? JSON.parse(fs.readFileSync("src/content/licensed/entrepreneur.json", "utf-8")) : null;
const pack = licensed ?? publicPack;

test("total and lowest", () => {
  const s = { F: 4, O: 3, R: 4, G: 3, E: 2 };
  assert.equal(total(s), 16);
  assert.deepEqual(lowest(s), ["E"]);
  assert.deepEqual(lowest({ F: 2, O: 2, R: 5, G: 4, E: 3 }), ["F", "O"]);
});

test("total bands follow the workbook ranges", () => {
  assert.equal(interpret(pack, { F: 5, O: 4, R: 5, G: 5, E: 4 }).band?.label, "20 to 25");
  assert.equal(interpret(pack, { F: 2, O: 2, R: 5, G: 4, E: 3 }).band?.label, "14 to 19");
  assert.equal(interpret(pack, { F: 2, O: 3, R: 2, G: 2, E: 2 }).band?.label, "Below 14");
});

test("lowest-pillar guidance picks the range the score starts", { skip: !licensed }, () => {
  const r2 = interpret(pack, { F: 5, O: 5, R: 5, G: 5, E: 2 });
  assert.equal(r2.focus, "E");
  assert.equal(r2.guidance.min, 2);
  const r1 = interpret(pack, { F: 5, O: 5, R: 5, G: 5, E: 1 });
  assert.equal(r1.guidance.min, 1);
  const r5 = interpret(pack, { F: 5, O: 5, R: 5, G: 5, E: 5 });
  assert.equal(r5.guidance.min, 4);
  assert.ok(r5.flat && isFlat({ F: 3, O: 3, R: 3, G: 3, E: 3 }));
});

test("entrepreneur pattern: high R, low F and O", { skip: !entre }, () => {
  assert.equal(entrepreneurPatterns(entre, { F: 2, O: 2, R: 5, G: 4, E: 3 }).length, 1);
  assert.equal(entrepreneurPatterns(entre, { F: 4, O: 2, R: 5, G: 4, E: 3 }).length, 0);
});

test("cycle position and the no-failure practice summary", () => {
  const start = new Date(); start.setDate(start.getDate() - 9);
  const p = cyclePosition(start);
  assert.equal(p.day, 10);
  assert.equal(p.week, 2);
  const late = new Date(); late.setDate(late.getDate() - 40);
  assert.equal(cyclePosition(late).finished, true);
  assert.deepEqual(practiceSummary([{ status: "DONE" }, { status: "PARTIAL" }, { status: "NOT_YET" }]), { done: 1, partial: 1, notYet: 1, practiced: 2, logged: 3 });
});

test("content pack has no em dashes (house style)", { skip: !licensed }, () => {
  assert.equal(JSON.stringify(licensed).includes("\u2014"), false);
});
