/**
 * End-to-end acceptance test (fictional data). Requires a running server and a seeded database:
 *   npm run build && npm run db:reset && npm start   (in another shell)
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 * Uses the pre-installed Playwright. Screenshots go to test-results/.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = new PrismaClient();
const shots = "test-results";
fs.mkdirSync(shots, { recursive: true });

type Page = import("playwright").Page;
let step = 0;
async function check(name: string, fn: () => Promise<void>) {
  step++;
  try {
    await fn();
    console.log(`  ok ${step} ${name}`);
  } catch (e) {
    console.log(`  FAIL ${step} ${name}`);
    throw e;
  }
}
const login = async (page: Page, email: string, password = "demo-password-1") => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((u: URL) => !u.pathname.startsWith("/login")), page.click('button:has-text("Sign in")')]);
};
const logout = async (page: Page) => {
  await page.context().clearCookies();
};
const submitAndWait = async (page: Page, selector: string) => {
  await Promise.all([page.waitForLoadState("networkidle"), page.click(selector)]);
  await page.waitForTimeout(250);
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page: Page = await ctx.newPage();
  const email = `e2e-${Date.now()}@example.test`;
  console.log("Participant workflow");

  await check("1. create an account", async () => {
    await page.goto(`${BASE}/signup`);
    await page.fill('input[name="name"]', "Test Driver (E2E)");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "e2e-password-123");
    await Promise.all([page.waitForURL("**/onboarding"), page.click('button:has-text("Create account")')]);
    await page.screenshot({ path: `${shots}/01-onboarding.png`, fullPage: true });
    await Promise.all([page.waitForURL("**/assessment"), page.locator('form:has(input[value="PERSONAL"]) button').click()]);
  });

  let assessmentUrl = "";
  await check("2. complete a FORGE assessment", async () => {
    const scores: Record<string, number> = { F: 4, O: 3, R: 4, G: 3, E: 2 };
    for (const [k, v] of Object.entries(scores)) await page.locator(`input[name="${k}"][value="${v}"]`).check({ force: true });
    await page.locator("fieldset", { hasText: "Emotionally Anchored" }).locator("summary", { hasText: "Add a reflection" }).click();
    await page.fill('textarea[name="reflE"]', "When my numbers get questioned in front of my boss, I get sharp.");
    await page.screenshot({ path: `${shots}/02-assessment.png`, fullPage: false });
    await Promise.all([page.waitForURL(/\/assessment\/[a-z0-9]+$/), page.click('button:has-text("See my profile")')]);
    assessmentUrl = page.url();
    await page.waitForSelector("text=16 / 25");
    await page.screenshot({ path: `${shots}/03-profile.png`, fullPage: true });
  });

  await check("3. identify a development priority", async () => {
    await Promise.all([page.waitForURL("**/plan"), page.click('button:has-text("my development priority")')]);
    const p = await db.profile.findFirst({ where: { user: { email } } });
    assert.equal(p?.priorityPillar, "E");
    await page.fill('textarea[name="destination"]', "A leader my team trusts with bad news.");
    await page.fill('textarea[name="forgeStatement"]', "I am becoming a steadier leader.");
    await submitAndWait(page, 'form:has(textarea[name="destination"]) button[type="submit"]');
  });

  await check("4. create a Discipline by Design Blueprint", async () => {
    await page.goto(`${BASE}/blueprint`);
    const routines = page.locator("section", { hasText: "Personal commitments and routines" });
    await routines.locator("summary", { hasText: "Add to this area" }).click();
    await routines.locator('button:has-text("Journaling")').click(); // quick pick fills the field
    assert.equal(await routines.locator('input[name="title"]').inputValue(), "Journaling");
    await routines.locator('input[name="title"]').fill("Fifteen quiet minutes before email");
    await routines.locator('select[name="whenDays"]').selectOption("Weekdays");
    await routines.locator('input[name="whenTime"]').fill("06:30");
    await Promise.all([page.waitForLoadState("networkidle"), routines.locator('button[type="submit"]:has-text("Add")').click()]);
    await page.waitForSelector("text=Fifteen quiet minutes before email");
    await page.waitForSelector("text=Weekdays, 6:30 am");
    await page.screenshot({ path: `${shots}/04-blueprint.png`, fullPage: false });
  });

  await check("5. name an accountability relationship", async () => {
    await page.goto(`${BASE}/network`);
    await page.fill('input[name="name"]', "Jamie Cole");
    await page.locator('select[name="role"]').selectOption("MENTOR");
    await page.locator('button:has-text("Perspective from further up the road")').click();
    assert.equal(await page.inputValue('input[name="purpose"]'), "Perspective from further up the road");
    await page.locator('select[name="role"]').selectOption("ACCOUNTABILITY_PARTNER");
    await page.fill('input[name="purpose"]', "Checks on my pause practice");
    await page.locator('select[name="cadenceDays"]').selectOption("7");
    await submitAndWait(page, 'form:has(select[name="cadenceDays"]) button[type="submit"]');
    await page.waitForSelector("text=Jamie Cole");
    await page.screenshot({ path: `${shots}/05-network.png`, fullPage: true });
  });

  await check("6. start a 30-day development cycle", async () => {
    await page.goto(`${BASE}/cycle/new`);
    await page.locator('button:has-text("Pausing before I answer when a decision gets challenged")').click();
    assert.match(await page.inputValue('input[name="focus"]'), /Pausing before I answer/);
    await page.fill('input[name="focus"]', "Pause before I answer a challenge");
    await Promise.all([page.waitForURL("**/cycle"), page.click('button:has-text("Start the cycle")')]);
    await page.waitForSelector("text=Day 1 of 30");
  });

  await check("7. record a daily reflection", async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.locator('input[name="status"][value="DONE"]').check({ force: true });
    await page.locator('label:has(input[name="tags"][value="In a meeting"])').click();
    assert.ok(await page.locator('input[name="tags"][value="In a meeting"]').isChecked());
    await page.locator("summary:has-text('Add a note or reflection')").click();
    await page.fill('input[name="note"]', "Paused in the 10 am review");
    await page.fill('textarea[name="reflection"]', "E2E-REFLECTION-TEXT: the pause gave me room.");
    await submitAndWait(page, 'button:has-text("Log today")');
    await page.screenshot({ path: `${shots}/06-dashboard.png`, fullPage: true });
  });

  await check("7a. weekly reflection with Blueprint checkboxes, no essay required", async () => {
    await page.goto(`${BASE}/reflect`);
    await page.locator('input[name="didIt"][value="PARTIAL"]').check();
    await page.locator('input[name="held"]').first().check();
    await page.fill('input[name="nextWeek"]', "Keep the pause going");
    await submitAndWait(page, 'button:has-text("Save this week")');
    const w = await db.weeklyReflection.findFirstOrThrow({ where: { user: { email } } });
    assert.equal(JSON.parse(w.held).length, 1);
    const c = await db.dailyCheckIn.findFirstOrThrow({ where: { user: { email } } });
    assert.deepEqual(JSON.parse(c.tags), ["In a meeting"]);
  });

  await check("7b. FORGE Plan: priority open, one-move suggestion fills the field", async () => {
    await page.goto(`${BASE}/plan`);
    const pri = page.locator("details[open]", { hasText: "Emotionally Anchored" });
    await pri.locator('button:has-text("one breath, one question")').click();
    assert.match(await pri.locator('input[name="oneMove"]').inputValue(), /one breath/);
    await Promise.all([page.waitForLoadState("networkidle"), pri.locator('button:has-text("Save E")').click()]);
    const g = await db.developmentGoal.findFirstOrThrow({ where: { user: { email }, pillar: "E", segmentKey: null } });
    assert.match(g.oneMove, /one breath/);
    assert.equal(await page.locator("details[open]", { hasText: "Future Focused" }).count(), 0, "non-priority pillars start folded");
    await page.screenshot({ path: `${shots}/06b-plan.png`, fullPage: false });
  });

  await check("7c. EQ-i is optional: opt in, link a priority to a pillar, put it to work", async () => {
    await page.goto(`${BASE}/pathway/eqi`);
    await page.waitForSelector("text=you can skip this");
    await submitAndWait(page, 'button:has-text("I have had my EQ-i debrief")');
    const add = page.locator("form", { hasText: "Priority from my debrief" });
    await add.locator('input[name="label"]').fill("Impulse control in budget meetings");
    await add.locator('select[name="pillar"]').selectOption("E");
    await add.locator("summary").click();
    await add.locator('input[name="practice"]').fill("One breath before I answer");
    await Promise.all([page.waitForLoadState("networkidle"), add.locator('button:has-text("Add priority")').click()]);
    await page.waitForSelector("text=Start a 30-day cycle on Emotionally Anchored");
    assert.equal(await page.locator('button:has-text("Share with")').count(), 0, "no share button without a coach");
    await page.screenshot({ path: `${shots}/06c-eqi.png`, fullPage: true });
    await Promise.all([page.waitForURL("**/blueprint"), page.click('button:has-text("Add the practice to my Blueprint")')]);
    await page.waitForSelector("text=One breath before I answer");
    await page.goto(`${BASE}/pathway/eqi`);
    await Promise.all([page.waitForURL(/\/cycle\/new\?pillar=E/), page.click('a:has-text("Start a 30-day cycle on Emotionally Anchored")')]);
    assert.equal(await page.inputValue('input[name="focus"]'), "One breath before I answer");
    assert.ok(await page.locator('input[name="pillar"][value="E"]').isChecked());
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector("text=From my EQ-i debrief");
  });

  await check("1b/7d. sign out, sign back in, saved progress and reflection retrieved", async () => {
    await logout(page);
    await login(page, email, "e2e-password-123");
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector('button:has-text("Update today")');
    await page.goto(`${BASE}/history`);
    await page.waitForSelector("text=E2E-REFLECTION-TEXT");
  });

  await check("8. review progress over time", async () => {
    await page.waitForSelector("text=FORGE readings");
    const res = await page.request.get(`${BASE}/export`);
    assert.equal(res.status(), 200);
    const md = await res.text();
    assert.match(md, /Development Summary/);
    assert.match(md, /Fifteen quiet minutes/);
    await page.screenshot({ path: `${shots}/07-history.png`, fullPage: true });
  });

  await check("10a. participant cannot open another participant's assessment", async () => {
    const dana = await db.user.findUniqueOrThrow({ where: { email: "dana@demo.bothhands.app" } });
    const a = await db.assessment.findFirstOrThrow({ where: { userId: dana.id } });
    const res = await page.goto(`${BASE}/assessment/${a.id}`);
    assert.equal(res?.status(), 404);
    const coachPage = await page.goto(`${BASE}/coach/${dana.id}`);
    assert.ok(!coachPage?.url().includes("/coach/"), "participant is redirected away from coach pages");
  });
  void assessmentUrl;

  console.log("Sharing and coach access");
  const dana = await db.user.findUniqueOrThrow({ where: { email: "dana@demo.bothhands.app" } });
  const lena = await db.user.findUniqueOrThrow({ where: { email: "lena@demo.bothhands.app" } });

  await check("9. share selected information (FORGE scores) with the assigned coach", async () => {
    await logout(page);
    await login(page, "dana@demo.bothhands.app");
    await page.goto(`${BASE}/sharing`);
    await submitAndWait(page, 'button[aria-label="Share: FORGE scores"]');
    await page.waitForSelector('button[aria-label="Stop sharing: FORGE scores"]');
    await page.screenshot({ path: `${shots}/08-sharing.png`, fullPage: true });
  });

  await check("9b. coach reviews permitted information", async () => {
    await logout(page);
    await login(page, "coach@demo.bothhands.app");
    await page.goto(`${BASE}/coach/${dana.id}`);
    await page.waitForSelector("text=FORGE reading");
    await page.waitForSelector("text=Total 16 / 25");
    await page.waitForSelector("text=The question bought me five seconds");
    await page.waitForSelector("text=Impulse control when challenged in meetings");
    await page.screenshot({ path: `${shots}/09-coach-participant.png`, fullPage: true });
  });

  await check("10b. private material stays inaccessible to the coach", async () => {
    const html = await page.content();
    assert.ok(!html.includes("PRIVATE DEMO JOURNAL"), "journal leaked");
    assert.ok(!html.includes("I was exhausted"), "unshared reflection leaked");
    const j = await page.goto(`${BASE}/journal`);
    assert.ok(!j?.url().endsWith("/journal"), "coach redirected away from journal");
    const r = await page.goto(`${BASE}/coach/${lena.id}`);
    assert.equal(r?.status(), 404, "unassigned participant hidden");
  });

  await check("10b2. coach adds a client directly; the client signs in; nothing is shared by default", async () => {
    const clientEmail = `client-${Date.now()}@example.test`;
    await page.goto(`${BASE}/coach`);
    await page.fill('input[name="name"]', "Casey Client (E2E)");
    await page.fill('input[name="email"]', clientEmail);
    await page.click('button:has-text("Add client")');
    await page.waitForSelector("text=Temporary password");
    const temp = await page.locator("code").first().innerText();
    assert.ok(temp.length >= 10);
    await page.waitForSelector("text=Casey Client (E2E)");
    const client = await db.user.findUniqueOrThrow({ where: { email: clientEmail } });
    assert.equal(client.role, "PARTICIPANT");
    await page.goto(`${BASE}/coach/${client.id}`);
    await page.waitForSelector("text=nothing yet");
    // the client can sign in with the temporary password and lands on onboarding
    const c2 = await browser.newContext();
    const cp: Page = await c2.newPage();
    await login(cp, clientEmail, temp);
    await cp.waitForURL("**/account/password");
    await cp.goto(`${BASE}/dashboard`);
    await cp.waitForURL("**/account/password"); // cannot skip it
    await cp.fill('input[name="current"]', "wrong-password-000");
    await cp.fill('input[name="next"]', "casey-new-password-1");
    await cp.fill('input[name="confirm"]', "casey-new-password-1");
    await cp.click('button:has-text("Change password")');
    await cp.waitForSelector("text=The current password is wrong.");
    await cp.fill('input[name="current"]', temp);
    await cp.fill('input[name="next"]', "casey-new-password-1");
    await cp.fill('input[name="confirm"]', "casey-new-password-2");
    await cp.click('button:has-text("Change password")');
    await cp.waitForSelector("text=don't match");
    await cp.fill('input[name="current"]', temp);
    await cp.fill('input[name="next"]', "casey-new-password-1");
    await cp.fill('input[name="confirm"]', "casey-new-password-1");
    await cp.click('button:has-text("Change password")');
    await cp.waitForSelector("text=Your password is changed");
    await Promise.all([cp.waitForURL("**/onboarding"), cp.click('a:has-text("Continue")')]);
    // the temporary password no longer works; the new one does
    const c3 = await browser.newContext();
    const tp: Page = await c3.newPage();
    await tp.goto(`${BASE}/login`);
    await tp.fill('input[name="email"]', clientEmail);
    await tp.fill('input[name="password"]', temp);
    await tp.click('button:has-text("Sign in")');
    await tp.waitForSelector("text=don't match");
    await login(tp, clientEmail, "casey-new-password-1");
    await tp.waitForURL("**/onboarding");
    await c3.close();
    await cp.goto(`${BASE}/sharing`);
    await cp.waitForSelector("text=Avery Lin");
    // the coach resets the client's password: the client is signed out, told who did it, and must choose a new one
    await page.goto(`${BASE}/coach/${client.id}`);
    await page.locator("summary", { hasText: "Reset Casey Client" }).click();
    await page.click('button:has-text("Reset password")');
    await page.waitForSelector("text=New temporary password");
    const temp2 = await page.locator("code").first().innerText();
    const kicked = await cp.goto(`${BASE}/dashboard`);
    assert.ok(kicked?.url().includes("/login"), "client was signed out by the reset");
    await cp.fill('input[name="email"]', clientEmail);
    await cp.fill('input[name="password"]', "casey-new-password-1");
    await cp.click('button:has-text("Sign in")');
    await cp.waitForSelector("text=don't match");
    await login(cp, clientEmail, temp2);
    await cp.waitForURL("**/account/password");
    await cp.waitForSelector("text=Your password was reset by Avery Lin");
    assert.equal(await db.auditEvent.count({ where: { action: "coach.reset_password", targetUserId: client.id } }), 1);
    await c2.close();
    // adding an existing email again does not create a second account
    await page.goto(`${BASE}/coach`);
    await page.fill('input[name="name"]', "Casey Again");
    await page.fill('input[name="email"]', clientEmail);
    await page.click('button:has-text("Add client")');
    await page.waitForSelector("text=already had an account");
    assert.equal(await db.user.count({ where: { email: clientEmail } }), 1);
    // a coach cannot add a coach or admin account as a client
    await page.fill('input[name="name"]', "Admin");
    await page.fill('input[name="email"]', "admin@demo.bothhands.app");
    await page.click('button:has-text("Add client")');
    await page.waitForSelector("text=belongs to a coach or administrator");
    // remove
    await page.goto(`${BASE}/coach/${client.id}`);
    await page.locator("summary", { hasText: "Stop coaching" }).click();
    await Promise.all([page.waitForURL(/\/coach$/), page.click('button:has-text("Remove from my clients")')]);
    const gone = await page.goto(`${BASE}/coach/${client.id}`);
    assert.equal(gone?.status(), 404);
  });

  await check("10c. admin sees aggregate reports, not individual records", async () => {
    await logout(page);
    await login(page, "admin@demo.bothhands.app");
    await page.goto(`${BASE}/admin/reports`);
    await page.waitForSelector("text=completed all segments");
    const html = await page.content();
    assert.ok(!html.includes("PRIVATE DEMO JOURNAL") && !html.includes("five seconds"));
    const r = await page.goto(`${BASE}/coach/${dana.id}`);
    assert.ok(!r?.url().includes(`/coach/${dana.id}`));
    await page.goto(`${BASE}/admin`);
    await page.locator("a", { hasText: "Spring Manager Cohort" }).click();
    await page.waitForSelector("text=Attendance");
    await page.screenshot({ path: `${shots}/10-admin-cohort.png`, fullPage: true });
  });

  await check("11. admin turns on coaching, assigns self, sees only what is shared", async () => {
    await page.goto(`${BASE}/admin`);
    await submitAndWait(page, 'button:has-text("I also coach")');
    await page.waitForSelector("text=Turn off coaching for my account");
    await page.locator("a", { hasText: "Spring Manager Cohort" }).click();
    const row = page.locator("tr", { hasText: "Lena Ortiz" });
    await row.locator('select[name="coachId"]').selectOption({ label: "Jordan Park (Demo Admin) (me)" });
    await row.locator('button:has-text("Assign")').click();
    await row.locator('button:has-text("Assign")').waitFor({ state: "detached" });
    await page.goto(`${BASE}/coach`);
    await page.waitForSelector("text=Lena Ortiz");
    await page.waitForSelector("text=0 of 7 areas shared");
    const denied = await page.goto(`${BASE}/coach/${dana.id}`);
    assert.equal(denied?.status(), 404, "admin-coach cannot open someone they do not coach");
    const j = await page.goto(`${BASE}/journal`);
    assert.ok(!j?.url().endsWith("/journal"));
  });

  await check("desktop layout renders", async () => {
    await logout(page);
    const desk = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await desk.goto(`${BASE}/login`);
    await desk.screenshot({ path: `${shots}/11-login-desktop.png` });
    await desk.fill('input[name="email"]', "dana@demo.bothhands.app");
    await desk.fill('input[name="password"]', "demo-password-1");
    await Promise.all([desk.waitForURL("**/dashboard"), desk.click('button:has-text("Sign in")')]);
    await desk.screenshot({ path: `${shots}/12-dashboard-desktop.png`, fullPage: true });
    await desk.close();
  });

  await browser.close();
  await db.$disconnect();
  console.log(`\nAll ${step} checks passed.`);
})().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
