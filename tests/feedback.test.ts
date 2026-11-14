/**
 * My feedback stays private: the coach sees an entry only when the client shares that entry AND the
 * FEEDBACK scope; the AI companion reads a summary only when the client allows it, and never the file.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { getCoachView } from "../src/lib/access";
import { participantContext } from "../src/lib/ai";
import type { CurrentUser } from "../src/lib/auth";

const db = new PrismaClient();
let coach: CurrentUser, dana: CurrentUser;
let id = "";

before(async () => {
  coach = (await db.user.findUniqueOrThrow({ where: { email: "coach@demo.bothhands.app" } })) as unknown as CurrentUser;
  dana = (await db.user.findUniqueOrThrow({ where: { email: "dana@demo.bothhands.app" } })) as unknown as CurrentUser;
  id = (await db.feedback.create({ data: { userId: dana.id, source: "CCL_360", title: "TEST 360", summary: "TEST-SUMMARY raters see me rush decisions", pillars: '["E"]', ownSummary: true, fileName: "notes.pdf", fileType: "application/pdf", fileSize: 4, fileData: new Uint8Array([1, 2, 3, 4]) } })).id;
});
after(async () => {
  await db.feedback.deleteMany({ where: { title: "TEST 360" } });
  await db.shareGrant.deleteMany({ where: { ownerId: dana.id, scope: "FEEDBACK" } });
  await db.$disconnect();
});

test("a private entry never reaches the coach, even with the scope on", async () => {
  assert.deepEqual((await getCoachView(coach, dana.id)).feedback, [], "no scope, nothing");
  await db.shareGrant.create({ data: { ownerId: dana.id, granteeId: coach.id, scope: "FEEDBACK" } });
  assert.deepEqual((await getCoachView(coach, dana.id)).feedback, [], "scope on, entry not shared, nothing");
});

test("a shared entry reaches the coach without the file's contents", async () => {
  await db.feedback.update({ where: { id }, data: { shareCoach: true } });
  const v = await getCoachView(coach, dana.id);
  assert.equal(v.feedback.length, 1);
  assert.match(v.feedback[0].summary, /TEST-SUMMARY/);
  assert.ok(!("fileData" in v.feedback[0]), "the coach view carries the file name, never the bytes");
});

test("the AI companion reads the summary only when the client allows it", async () => {
  assert.ok(!(await participantContext(dana.id)).includes("TEST-SUMMARY"), "off by default");
  await db.feedback.update({ where: { id }, data: { allowAi: true } });
  const ctx = await participantContext(dana.id);
  assert.ok(ctx.includes("TEST-SUMMARY"));
  assert.match(ctx, /not the report/);
});
