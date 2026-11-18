/**
 * Session prep: the AI brief for a coach is built only from what the client shares with that coach.
 * Runs against the seeded demo database, with the same functions the coach page uses. No AI call is made.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { getCoachView, getCoachWork } from "../src/lib/access";
import { briefContext, latestBrief, prepareBrief } from "../src/lib/coachBrief";
import { parseCoachBrief } from "../src/lib/ai";
import { getContent } from "../src/content";
import type { CurrentUser } from "../src/lib/auth";

const db = new PrismaClient();
let coach: CurrentUser, dana: CurrentUser, marcus: CurrentUser;
const asUser = (u: unknown) => u as CurrentUser;

before(async () => {
  const get = async (e: string) => asUser(await db.user.findUniqueOrThrow({ where: { email: e } }));
  [coach, dana, marcus] = await Promise.all(["coach", "dana", "marcus"].map((n) => get(`${n}@demo.bothhands.app`)));
});

const contextFor = async (p: CurrentUser, identityForAi = true) => {
  const { pack } = await getContent();
  return briefContext(await getCoachView(coach, p.id), await getCoachWork(coach, p.id), pack, identityForAi);
};

test("the brief's context carries what the client shares", async () => {
  const c = await contextFor(dana);
  assert.match(c, /First name: Dana/);
  assert.match(c, /Pausing before I answer/, "the shared 30-day focus");
  assert.match(c, /Asked Marco what he was seeing/, "a check-in the client marked shared");
  assert.match(c, /Commitments agreed last time/);
});

test("nothing private reaches the brief", async () => {
  const c = await contextFor(dana);
  assert.ok(!c.includes("PRIVATE DEMO JOURNAL"), "never the journal");
  assert.ok(!c.includes("I was exhausted"), "never a check-in the client didn't share");
  assert.ok(!c.includes("Coach-private note") || c.includes("Coach's own notes"), "the coach's own notes are labeled as theirs");
  // Dana doesn't share her 30-day plan (PLAN) or her identity (IDENTITY) with the coach in the demo
  assert.ok(!c.includes("Their 30-day plan"));
  assert.ok(!c.includes("Their identity statement"));
});

test("a client who shares nothing gives the brief nothing of theirs", async () => {
  const c = await contextFor(marcus);
  assert.match(c, /Shared with the coach: nothing/);
  assert.ok(!c.includes("PRIVATE DEMO JOURNAL (Marcus)"));
  assert.ok(!c.includes("FORGE line"));
});

test("the client's own AI switch stops the brief", async () => {
  const before = await db.profile.findUniqueOrThrow({ where: { userId: dana.id } });
  await db.profile.update({ where: { userId: dana.id }, data: { aiEnabled: false } });
  const prev = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = prev || "test-key-not-used";
  try {
    const r = await prepareBrief(coach, dana.id);
    assert.deepEqual(r, { ok: false, reason: "client_ai_off" });
  } finally {
    if (prev === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prev;
    await db.profile.update({ where: { userId: dana.id }, data: { aiEnabled: before.aiEnabled } });
  }
});

test("a brief disappears once the client turns off an area it used", async () => {
  await db.coachBrief.create({ data: { coachId: coach.id, participantId: dana.id, scopes: "PRACTICE,REFLECTIONS", content: JSON.stringify({ since: ["x"], patterns: [], questions: [], exercise: null, careful: "" }) } });
  assert.ok(await latestBrief(coach.id, dana.id, ["GOALS", "PRACTICE", "REFLECTIONS"]), "shown while everything is still shared");
  assert.equal(await latestBrief(coach.id, dana.id, ["GOALS", "PRACTICE"]), null, "hidden once REFLECTIONS is off");
  assert.equal(await db.coachBrief.count({ where: { coachId: coach.id, participantId: dana.id } }), 0, "and deleted");
});

test("the brief's JSON is read safely", () => {
  const b = parseCoachBrief('Here: {"since": ["Seven check-ins"], "patterns": ["The pause works with peers"], "questions": ["a", "b", "c", "d"], "exercise": {"ref": "ed:0", "why": "fits"}, "careful": ""}');
  assert.ok(b);
  assert.equal(b!.questions.length, 3, "three questions at most");
  assert.equal(b!.exercise?.ref, "ed:0");
  assert.equal(parseCoachBrief("no json"), null);
  assert.equal(parseCoachBrief('{"since": [], "patterns": [], "questions": []}'), null, "an empty brief is no brief");
});
