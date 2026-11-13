/** Seasons: months are numbered in order, a full season takes no more, and starting a new one closes the old. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { nextMonth, seasonForNewCycle } from "../src/lib/season";

const db = new PrismaClient();
let userId = "";
before(async () => {
  const u = await db.user.create({ data: { email: `season-${Date.now()}@example.test`, name: "Season Test", role: "PARTICIPANT", passwordHash: "x", isDemo: true } });
  userId = u.id;
});
after(async () => {
  await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

const addCycle = (s: { seasonId: string | null; seasonMonth: number | null }) =>
  db.developmentCycle.create({ data: { userId, template: "NIRS_30", pillar: "E", startDate: new Date(), status: "COMPLETED", ...s } });

test("next month counts up to three, then stops", () => {
  assert.equal(nextMonth(0), 1);
  assert.equal(nextMonth(2), 3);
  assert.equal(nextMonth(3), null);
});

test("a season fills month by month, and a new season closes the old one", async () => {
  assert.deepEqual(await seasonForNewCycle(userId, ""), { seasonId: null, seasonMonth: null }, "no season unless asked");
  const m1 = await seasonForNewCycle(userId, "new");
  assert.equal(m1.seasonMonth, 1);
  await addCycle(m1);
  const m2 = await seasonForNewCycle(userId, "continue");
  assert.deepEqual(m2, { seasonId: m1.seasonId, seasonMonth: 2 });
  await addCycle(m2);
  await addCycle(await seasonForNewCycle(userId, "continue"));
  const full = await seasonForNewCycle(userId, "new");
  assert.notEqual(full.seasonId, m1.seasonId, "a full season starts a new one");
  assert.equal((await db.season.findUniqueOrThrow({ where: { id: m1.seasonId! } })).status, "STOPPED");
});
