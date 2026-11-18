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

test("the assistant matches a name to exactly one client, or none", async () => {
  const { resolveClient } = await import("../src/lib/coachAssistant");
  const clients = [{ id: "1", name: "Bob Hart" }, { id: "2", name: "Paul Ito" }, { id: "3", name: "Paula Ito" }];
  assert.equal(resolveClient("Bob", clients)?.id, "1");
  assert.equal(resolveClient("paul ito", clients)?.id, "2");
  assert.equal(resolveClient("Ito", clients), null, "two Itos: no guess");
  assert.equal(resolveClient("Sam", clients), null);
});

test("the assistant's plan is read safely", async () => {
  const { parseCoachPlan } = await import("../src/lib/ai");
  const p = parseCoachPlan('{"actions": [{"type": "assign_exercise", "client": "Bob", "exerciseRef": "ed:1", "title": "", "instructions": "", "dueOn": "2030-01-04"}, {"type": "schedule_session", "client": "Paul", "when": "Tuesday 10am", "agenda": ""}, {"type": "delete_everything", "client": "Bob"}], "unclear": ["no time for Paul"]}');
  assert.ok(p);
  assert.equal(p!.actions.length, 1, "a session without a real time is dropped, and unknown action types are ignored");
  assert.equal(p!.actions[0].type, "assign_exercise");
  assert.deepEqual(p!.unclear, ["no time for Paul"]);
});

test("cohort prep sees group totals only: no names, nothing anyone wrote", async () => {
  const { cohortPulse } = await import("../src/lib/reports");
  const c = await db.cohort.findFirstOrThrow({ where: { isDemo: true }, include: { members: { include: { user: true } } } });
  const p = await cohortPulse(c.id);
  assert.equal(p.small, false);
  assert.match(p.text, /Daily check-ins, last 14 days: \d+ of \d+ people/);
  for (const m of c.members) assert.ok(!p.text.includes(m.user.name.split(" (")[0]), `no name: ${m.user.name}`);
  assert.ok(!p.text.includes("Marco") && !p.text.includes("exhausted") && !p.text.includes("PRIVATE"), "no written text");
});

test("a small group gets no totals at all", async () => {
  const { cohortPulse } = await import("../src/lib/reports");
  const c = await db.cohort.findFirstOrThrow({ where: { isDemo: true }, include: { members: { where: { role: "PARTICIPANT" } } } });
  const keep = c.members.slice(0, 3).map((m) => m.id);
  const removed = c.members.filter((m) => !keep.includes(m.id));
  await db.cohortMember.deleteMany({ where: { id: { in: removed.map((m) => m.id) } } });
  try {
    const p = await cohortPulse(c.id);
    assert.equal(p.small, true);
    assert.ok(!p.text.includes("check-ins"), "nothing about practice");
  } finally {
    await db.cohortMember.createMany({ data: removed.map(({ id, cohortId, userId, role }) => ({ id, cohortId, userId, role })) });
  }
});

test("who needs me ranks by what needs attention, with plain reasons", async () => {
  const { needsMe } = await import("../src/lib/coachSummary");
  const v = await getCoachView(coach, dana.id);
  const quiet = needsMe(v, [], [{ title: "Old one", status: "ASSIGNED", dueOn: new Date(Date.now() - 864e5) }]);
  assert.ok(quiet.reasons.includes("Exercise overdue: Old one"));
  assert.ok(quiet.reasons.includes("No session booked yet"));
  const booked = needsMe(v, [{ scheduledAt: new Date(Date.now() + 2 * 864e5) }, { scheduledAt: new Date(Date.now() - 5 * 864e5) }], []);
  assert.ok(!booked.reasons.some((r) => r.startsWith("No session")));
  assert.ok(quiet.weight > booked.weight);
  const m = needsMe(await getCoachView(coach, marcus.id), [], []);
  assert.ok(m.reasons.includes("Marcus hasn't shared anything with you yet"));
});

test("wrap-up and cohort prep JSON are read safely", async () => {
  const { parseWrapUp, parseCohortPrep } = await import("../src/lib/ai");
  const w = parseWrapUp('{"notes": "n", "commitments": "Ask one question first on Thursday", "followUp": "Thanks", "exercise": null}');
  assert.equal(w?.commitments, "Ask one question first on Thursday");
  assert.equal(parseWrapUp('{"notes": "", "commitments": "", "followUp": ""}'), null);
  const c = parseCohortPrep('{"working": ["a"], "stuck": [], "plan": [{"minutes": "15", "part": "Open", "detail": "x"}, {"minutes": 9999, "part": "Long", "detail": ""}, {"part": ""}], "questions": ["q1"]}');
  assert.equal(c?.plan.length, 2);
  assert.equal(c?.plan[0].minutes, 15);
  assert.equal(c?.plan[1].minutes, 240, "minutes are kept sane");
});
