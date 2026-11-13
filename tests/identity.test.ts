/** Identity shift: tone selection, what the AI receives, and what a coach can see. Needs the seeded demo database. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { effectiveTone, toneBlock, TONE_LIMITS } from "../src/lib/identityTone";
import { participantContext, participantTone, systemPrompt } from "../src/lib/ai";
import { getCoachView } from "../src/lib/access";
import type { CurrentUser } from "../src/lib/auth";

const db = new PrismaClient();
let dana: { id: string }, coach: CurrentUser;

before(async () => {
  dana = await db.user.findUniqueOrThrow({ where: { email: "dana@demo.bothhands.app" } });
  coach = (await db.user.findUniqueOrThrow({ where: { email: "coach@demo.bothhands.app" } })) as unknown as CurrentUser;
  await db.identityProfile.deleteMany({ where: { userId: dana.id } });
  await db.identityProfile.create({
    data: { userId: dana.id, level: "REINVENT", role: "ID-ROLE", becoming: "ID-BECOMING", situation: "ID-SITUATION", behavior: "ID-BEHAVIOR", personaName: "ID-PERSONA", personaStandards: "ID-STANDARDS", personaCue: "ID-CUE" },
  });
});
after(async () => {
  await db.identityProfile.deleteMany({ where: { userId: dana.id } });
  await db.shareGrant.deleteMany({ where: { ownerId: dana.id, scope: "IDENTITY" } });
  await db.$disconnect();
});

test("tone follows the level, and the participant's own choice wins", () => {
  assert.equal(effectiveTone(null), null);
  assert.equal(effectiveTone({ level: "CORE", tone: "AUTO" }), "SUPPORTIVE");
  assert.equal(effectiveTone({ level: "ROLE", tone: "AUTO" }), "DIRECT");
  assert.equal(effectiveTone({ level: "REINVENT", tone: "AUTO" }), "DEMANDING");
  assert.equal(effectiveTone({ level: "REINVENT", tone: "SUPPORTIVE" }), "SUPPORTIVE");
  assert.equal(effectiveTone({ level: "CORE", tone: "DEMANDING" }), "DEMANDING");
});

test("every tone carries the fixed limits", () => {
  for (const t of ["SUPPORTIVE", "DIRECT", "DEMANDING"] as const) {
    const b = toneBlock(t);
    assert.ok(b.includes(TONE_LIMITS));
    assert.match(b, /Never insult/);
    assert.match(b, /psychological speculation/);
  }
  assert.equal(toneBlock(null), "");
  assert.match(toneBlock("DEMANDING"), /challenge excuses/);
  assert.doesNotMatch(toneBlock("SUPPORTIVE"), /challenge excuses/);
});

test("the tone reaches the system prompt", async () => {
  const tone = await participantTone(dana.id);
  assert.match(tone, /demanding/);
  assert.match(systemPrompt("COACH", "ctx", [], tone), /Never insult the participant/);
  assert.doesNotMatch(systemPrompt("COACH", "ctx", []), /Coaching tone for this participant/);
});

test("the AI gets the statement by default, the persona only when ticked, nothing when turned off", async () => {
  let ctx = await participantContext(dana.id);
  assert.ok(ctx.includes("ID-ROLE") && ctx.includes("ID-BEHAVIOR"), "role and behavior");
  assert.match(ctx, /kind of change[^\n]*identity reinvention/);
  assert.match(ctx, /Go slower/, "coaching guidance for the kind of change");
  assert.ok(!ctx.includes("ID-BECOMING"), "with a statement on the profile, the AI reads that one statement");
  assert.ok(!ctx.includes("ID-PERSONA") && !ctx.includes("ID-CUE"), "persona held back by default");
  await db.identityProfile.update({ where: { userId: dana.id }, data: { aiUsePersona: true } });
  ctx = await participantContext(dana.id);
  assert.ok(ctx.includes("ID-PERSONA") && ctx.includes("ID-CUE"));
  await db.identityProfile.update({ where: { userId: dana.id }, data: { aiUse: false } });
  ctx = await participantContext(dana.id);
  assert.ok(!ctx.includes("ID-"), "nothing from the identity layer when AI use is off");
  assert.equal(await participantTone(dana.id), "", "no tone change when AI use is off");
  await db.identityProfile.update({ where: { userId: dana.id }, data: { aiUse: true, aiUsePersona: false } });
});

test("a coach sees identity only with the IDENTITY scope, and the persona only when the client also allows it", async () => {
  let v = await getCoachView(coach, dana.id);
  assert.equal(v.identity, null);
  assert.ok(!JSON.stringify(v).includes("ID-"));
  await db.shareGrant.create({ data: { ownerId: dana.id, granteeId: coach.id, scope: "IDENTITY" } });
  v = await getCoachView(coach, dana.id);
  assert.equal(v.identity?.becoming, "ID-BECOMING");
  assert.equal(v.identity?.persona, null, "persona not shared until the client ticks the box");
  assert.ok(!JSON.stringify(v).includes("ID-PERSONA"));
  await db.identityProfile.update({ where: { userId: dana.id }, data: { sharePersona: true } });
  v = await getCoachView(coach, dana.id);
  assert.equal(v.identity?.persona?.name, "ID-PERSONA");
});

test("written identity notes on check-ins never reach the coach, even with sharing on", async () => {
  const c = await db.dailyCheckIn.findFirstOrThrow({ where: { userId: dana.id, shared: true } });
  await db.dailyCheckIn.update({ where: { id: c.id }, data: { identityActed: "YES", identityNote: "ID-NOTE-SECRET" } });
  try {
    const v = await getCoachView(coach, dana.id);
    assert.ok(v.practice.some((p) => p.identityActed === "YES"));
    assert.ok(!JSON.stringify(v).includes("ID-NOTE-SECRET"));
  } finally {
    await db.dailyCheckIn.update({ where: { id: c.id }, data: { identityActed: "", identityNote: "" } });
  }
});
