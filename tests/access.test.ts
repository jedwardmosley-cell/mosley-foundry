/**
 * Authorization tests against the seeded demo database.
 * Run after `npm run db:seed`. Uses the same functions every page uses.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { getCoachView, grantedScopes, ForbiddenError } from "../src/lib/access";
import { cohortReport, MIN_GROUP } from "../src/lib/reports";
import type { CurrentUser } from "../src/lib/auth";

const db = new PrismaClient();
let coach: CurrentUser, admin: CurrentUser, dana: CurrentUser, marcus: CurrentUser, priya: CurrentUser, lena: CurrentUser;
const asUser = (u: { id: string; email: string; name: string; role: string; orgId: string | null; isDemo: boolean }) => u as CurrentUser;

before(async () => {
  const get = async (e: string) => asUser(await db.user.findUniqueOrThrow({ where: { email: e } }));
  [coach, admin, dana, marcus, priya, lena] = await Promise.all(["coach", "admin", "dana", "marcus", "priya", "lena"].map((n) => get(`${n}@demo.bothhands.app`)));
});

test("coach sees only the scopes the participant granted", async () => {
  const v = await getCoachView(coach, dana.id);
  assert.deepEqual(new Set(v.scopes), new Set(["GOALS", "PRACTICE", "REFLECTIONS", "NETWORK", "EQI"]));
  assert.equal(v.assessment, null, "Dana did not share FORGE scores");
  assert.ok(v.profile?.forgeStatement, "goals scope includes FORGE Statement");
});

test("reflection text needs the scope AND the entry marked shared", async () => {
  const v = await getCoachView(coach, dana.id);
  const withText = v.practice.filter((p) => p.reflection);
  assert.equal(withText.length, 1);
  assert.match(withText[0].reflection!, /five seconds/);
  const all = JSON.stringify(v);
  assert.ok(!all.includes("Private note: I was exhausted"), "unshared reflection must not leak");
});

test("journal is unreachable through the coach view", async () => {
  const v = JSON.stringify(await getCoachView(coach, dana.id));
  assert.ok(!v.includes("PRIVATE DEMO JOURNAL"));
});

test("assigned participant who shared nothing exposes nothing but a name", async () => {
  const v = await getCoachView(coach, marcus.id);
  assert.equal(v.scopes.length, 0);
  assert.equal(v.profile, null);
  assert.equal(v.assessment, null);
  assert.deepEqual(v.practice, []);
  assert.deepEqual(v.goals, []);
});

test("coach cannot open a participant who is not assigned", async () => {
  await assert.rejects(() => getCoachView(coach, lena.id), ForbiddenError);
});

test("admins and other participants get no scopes", async () => {
  assert.equal((await grantedScopes(admin, dana.id)).size, 0);
  assert.equal((await grantedScopes(priya, dana.id)).size, 0);
  await assert.rejects(() => getCoachView(admin, dana.id), ForbiddenError);
});

test("revoking a grant takes effect immediately", async () => {
  await db.shareGrant.deleteMany({ where: { ownerId: dana.id, granteeId: coach.id, scope: "PRACTICE" } });
  try {
    const v = await getCoachView(coach, dana.id);
    assert.ok(v.practice.every((p) => p.status === null));
    assert.equal(v.cycle, null);
  } finally {
    await db.shareGrant.create({ data: { ownerId: dana.id, granteeId: coach.id, scope: "PRACTICE" } });
  }
});

test("EQ-i items are visible only when approved", async () => {
  const item = await db.eqiPriority.findFirstOrThrow({ where: { userId: dana.id } });
  await db.eqiPriority.update({ where: { id: item.id }, data: { participantApproved: false } });
  try {
    assert.equal((await getCoachView(coach, dana.id)).eqi.length, 0);
  } finally {
    await db.eqiPriority.update({ where: { id: item.id }, data: { participantApproved: true } });
  }
});

test("aggregate report thresholds small groups", async () => {
  const c = await db.cohort.findFirstOrThrow({ where: { isDemo: true } });
  const r = await cohortReport(c.id);
  assert.ok(r.n >= MIN_GROUP);
  assert.equal(typeof r.completedPct, "number");
  assert.ok(!JSON.stringify(r.bySegment).includes("reflection"));
});

test("coach views are audited", async () => {
  const before = await db.auditEvent.count({ where: { actorId: coach.id, targetUserId: dana.id } });
  await getCoachView(coach, dana.id);
  assert.equal(await db.auditEvent.count({ where: { actorId: coach.id, targetUserId: dana.id } }), before + 1);
});
