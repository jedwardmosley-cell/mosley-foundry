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
    await routines.locator("summary").click();
    await routines.locator('input[name="title"]').fill("Fifteen quiet minutes before email");
    await routines.locator('input[name="when"]').fill("6:30 am");
    await Promise.all([page.waitForLoadState("networkidle"), routines.locator('button:has-text("Add")').click()]);
    await page.waitForSelector("text=Fifteen quiet minutes before email");
    await page.screenshot({ path: `${shots}/04-blueprint.png`, fullPage: false });
  });

  await check("5. name an accountability relationship", async () => {
    await page.goto(`${BASE}/network`);
    await page.fill('input[name="name"]', "Jamie Cole");
    await page.fill('input[name="purpose"]', "Checks on my pause practice");
    await page.fill('input[name="cadenceDays"]', "7");
    await submitAndWait(page, 'form:has(input[name="cadenceDays"]) button[type="submit"]');
    await page.waitForSelector("text=Jamie Cole");
    await page.screenshot({ path: `${shots}/05-network.png`, fullPage: true });
  });

  await check("6. start a 30-day development cycle", async () => {
    await page.goto(`${BASE}/cycle/new`);
    await page.fill('input[name="focus"]', "Pause before I answer a challenge");
    await Promise.all([page.waitForURL("**/cycle"), page.click('button:has-text("Start the cycle")')]);
    await page.waitForSelector("text=Day 1 of 30");
  });

  await check("7. record a daily reflection", async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.locator('input[name="status"][value="DONE"]').check({ force: true });
    await page.fill('input[name="note"]', "Paused in the 10 am review");
    await page.locator("summary:has-text('Add a reflection')").click();
    await page.fill('textarea[name="reflection"]', "E2E-REFLECTION-TEXT: the pause gave me room.");
    await submitAndWait(page, 'button:has-text("Log today")');
    await page.screenshot({ path: `${shots}/06-dashboard.png`, fullPage: true });
  });

  await check("1b/7b. sign out, sign back in, saved progress and reflection retrieved", async () => {
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
