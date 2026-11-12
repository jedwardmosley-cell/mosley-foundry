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
    // a new client goes straight into the guided first session; this run takes the full pages instead
    await Promise.all([page.waitForURL("**/start"), page.locator('form:has(input[value="PERSONAL"]) button').click()]);
    await page.waitForSelector("text=Claim who you are");
    await page.goto(`${BASE}/assessment`);
  });

  let assessmentUrl = "";
  await check("2. complete a FORGE assessment", async () => {
    await page.waitForSelector('nav[aria-label="Your journey"] >> text=Step 1 of 5');
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
    await Promise.all([page.waitForURL(/\/blueprint(#one-move)?$/), page.click('button:has-text("my development priority")')]);
    await page.goto(`${BASE}/plan`);
    const p = await db.profile.findFirst({ where: { user: { email } } });
    assert.equal(p?.priorityPillar, "E");
    await page.fill('textarea[name="destination"]', "a leader my team trusts with bad news");
    await page.fill('textarea[name="lineO"]', "a discerning leader who sees what my team needs");
    await page.locator('button:has-text("Put my five statements together")').click();
    assert.equal(await page.inputValue('textarea[name="forgeStatement"]'), "I am a leader my team trusts with bad news. I am a discerning leader who sees what my team needs.");
    await submitAndWait(page, 'form:has(textarea[name="destination"]) button[type="submit"]');
    const saved = await db.profile.findFirstOrThrow({ where: { user: { email } } });
    assert.equal(saved.destination, "I am a leader my team trusts with bad news");
    assert.equal(saved.lineO, "I am a discerning leader who sees what my team needs");
  });

  await check("4. create a Discipline by Design blueprint", async () => {
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
    // the journey bar follows: steps 2 to 5 done, Who I am still open, and the 30 days under way
    await page.goto(`${BASE}/blueprint`);
    const bar = page.locator('nav[aria-label="Your journey"]');
    await bar.locator("text=Day 1 of 30").waitFor();
    assert.equal(await bar.locator("text=(done)").count(), 4, "four steps done before identity shift");
  });

  await check("7. record a daily reflection", async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.locator('input[name="status"][value="DONE"]').check({ force: true });
    await page.locator("summary:has-text('Add detail')").click();
    await page.locator('label:has(input[name="tags"][value="In a meeting"])').click();
    assert.ok(await page.locator('input[name="tags"][value="In a meeting"]').isChecked());
    await page.fill('input[name="note"]', "Paused in the 10 am review");
    await page.fill('textarea[name="reflection"]', "E2E-REFLECTION-TEXT: the pause gave me room.");
    await submitAndWait(page, 'button:has-text("Log today")');
    await page.screenshot({ path: `${shots}/06-dashboard.png`, fullPage: true });
  });

  await check("7a. weekly reflection with blueprint checkboxes, no essay required", async () => {
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

  await check("7b. Blueprint: one move this week, priority open, suggestion fills the field", async () => {
    await page.goto(`${BASE}/blueprint`);
    assert.equal(await (await page.request.get(`${BASE}/plan`)).text().then((t) => t.includes('name="oneMove"')), false, "one move is no longer on the FORGE plan");
    const pri = page.locator("details[open]", { hasText: "Emotionally Anchored" });
    await pri.locator('summary:has-text("Ideas")').click();
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
    await Promise.all([page.waitForURL("**/blueprint"), page.click('button:has-text("Add the practice to my blueprint")')]);
    await page.waitForSelector("text=One breath before I answer");
    await page.goto(`${BASE}/pathway/eqi`);
    await Promise.all([page.waitForURL(/\/cycle\/new\?pillar=E/), page.click('a:has-text("Start a 30-day cycle on Emotionally Anchored")')]);
    assert.equal(await page.inputValue('input[name="focus"]'), "One breath before I answer");
    assert.ok(await page.locator('input[name="pillar"][value="E"]').isChecked());
  });

  await check("7e. Identity shift: explore all three levels, choose one, change it later, history kept", async () => {
    await page.goto(`${BASE}/dashboard`);
    assert.ok(!(await page.locator("main").innerText()).includes("follows through"), "no identity statement until the person writes one");
    await page.goto(`${BASE}/identity`);
    await page.fill('textarea[name="claim"]', "someone who follows through on what I say.");
    await page.fill('input[name="behavior"]', "I close every open commitment by Friday noon.");
    for (const name of ["Core alignment", "Role transition", "Identity reinvention"]) {
      await page.locator("label", { hasText: name }).click();
    }
    await page.waitForSelector("text=Deliberately construct a new performance identity.");
    await page.locator("label", { hasText: "Core alignment" }).click();
    await page.waitForSelector("text=Strengthen who I am.");
    assert.ok(!(await page.locator('input[name="personaName"]').isVisible()), "persona fields hidden outside Level 3");
    await Promise.all([page.waitForURL("**/identity?saved=1"), page.click('button:has-text("Save my identity shift")')]);
    const me = await db.user.findUniqueOrThrow({ where: { email } });
    assert.equal((await db.identityProfile.findUniqueOrThrow({ where: { userId: me.id } })).level, "CORE");
    await page.goto(`${BASE}/dashboard`);
    // the I am statement leads the Today card
    await page.waitForSelector("main section >> text=I am someone who follows through on what I say.");
    // change to Level 3 with an optional performance identity
    await page.goto(`${BASE}/identity`);
    await page.locator("label", { hasText: "Identity reinvention" }).click();
    await page.locator("summary", { hasText: "Create a performance identity" }).click();
    await page.fill('input[name="personaName"]', "The Closer");
    await page.fill('textarea[name="personaStandards"]', "I finish what I start.");
    await Promise.all([page.waitForURL("**/identity?saved=1"), page.click('button:has-text("Save changes")')]);
    await page.waitForSelector("text=Earlier versions");
    const hist = await db.identityHistory.findMany({ where: { userId: me.id } });
    assert.equal(hist.length, 1);
    assert.equal(hist[0].level, "CORE");
    assert.equal(await db.assessment.count({ where: { userId: me.id } }), 1, "FORGE records untouched");
    assert.equal(await db.developmentCycle.count({ where: { userId: me.id } }), 1);
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector("text=The Closer");
    await page.screenshot({ path: `${shots}/06e-identity-card.png` });
    const priority = await db.profile.findUniqueOrThrow({ where: { userId: me.id } });
    assert.equal(priority.priorityPillar, "E", "choosing a level never changes the FORGE priority");
  });

  await check("7f. the level shapes the FORGE plan, blueprint, cycle and check-in, all optional", async () => {
    const me = await db.user.findUniqueOrThrow({ where: { email } });
    await page.goto(`${BASE}/blueprint`);
    await page.waitForSelector("text=For identity reinvention:");
    await page.waitForSelector("text=Use your activation cue to prepare before a demanding situation.");
    await page.goto(`${BASE}/blueprint`);
    const card = page.locator("section", { hasText: "Identity practice" }).first();
    await card.waitFor();
    await card.locator("text=Write your activation cue first").waitFor(); // no cue written yet, so nothing is added for them
    const before = await db.commitment.count({ where: { userId: me.id } });
    await Promise.all([page.waitForLoadState("networkidle"), card.locator('button:has-text("Add a weekly review against my standards")').click()]);
    await card.locator("text=In your blueprint").waitFor();
    assert.equal(await db.commitment.count({ where: { userId: me.id } }), before + 1, "only the one the person tapped is added");
    const added = await db.commitment.findFirstOrThrow({ where: { userId: me.id, detail: "Identity shift" } });
    assert.equal(added.cadence, "WEEKLY");
    await page.goto(`${BASE}/cycle/new`);
    await page.locator('button:has-text("I close every open commitment by Friday noon.")').click();
    assert.equal(await page.inputValue('input[name="focus"]'), "I close every open commitment by Friday noon.");
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector("text=Showed up as who I am?");
    await page.waitForSelector('input[placeholder="Where did you meet your standard today, and where did you fall short?"]', { state: "attached" });
    // the question is optional: saving without it still works
    await submitAndWait(page, 'button:has-text("Update today")');
    assert.equal((await db.dailyCheckIn.findFirstOrThrow({ where: { userId: me.id } })).identityActed, "");
    await page.locator('label:has(input[name="identityActed"][value="PARTLY"])').click();
    await submitAndWait(page, 'button:has-text("Update today")');
    const ci = await db.dailyCheckIn.findFirstOrThrow({ where: { userId: me.id } });
    assert.equal(ci.identityActed, "PARTLY");
    assert.equal(ci.status, "DONE", "Done / Partial / Not yet is unchanged");
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
    assert.match(md, /Development summary/);
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

  await check("1c. guided first session: who I am, FORGE identity, assessment, road, 30 days", async () => {
    const gc = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const g: Page = await gc.newPage();
    await g.goto(`${BASE}/signup`);
    await g.fill('input[name="name"]', "Guided Driver (E2E)");
    await g.fill('input[name="email"]', `e2e-guided-${Date.now()}@example.test`);
    await g.fill('input[name="password"]', "e2e-password-123");
    await Promise.all([g.waitForURL("**/onboarding"), g.click('button:has-text("Create account")')]);
    await Promise.all([g.waitForURL("**/start"), g.locator('form:has(input[value="LEADING_OTHERS"]) button').click()]);
    // 1. who I am
    await g.locator('summary:has-text("Examples")').first().click();
    await g.locator('button:has-text("a leader now. My results come through other people.")').first().click();
    await g.locator("label", { hasText: "Role transition" }).click();
    await Promise.all([g.waitForURL("**/start?step=2"), g.click('button:has-text("Save and continue")')]);
    // 2. FORGE identity: the identity is offered as the first F example
    await g.locator('summary:has-text("Examples")').first().click();
    await g.locator('button:has-text("a leader now. My results come through other people.")').first().click();
    await Promise.all([g.waitForURL("**/start?step=3"), g.click('button:has-text("Save and continue")')]);
    // 3. where I am: the assessment and the priority bring the client back
    await Promise.all([g.waitForURL("**/assessment?next=start"), g.click('a:has-text("Take the FORGE assessment")')]);
    for (const [k, v] of Object.entries({ F: 4, O: 3, R: 4, G: 3, E: 2 })) await g.locator(`input[name="${k}"][value="${v}"]`).check({ force: true });
    await Promise.all([g.waitForURL(/\/assessment\/[a-z0-9]+\?next=start$/), g.click('button:has-text("See my profile")')]);
    await Promise.all([g.waitForURL("**/start?step=4"), g.click('button:has-text("my development priority")')]);
    // 4. my road: one routine and one person
    await g.locator('button:has-text("Journaling")').click();
    await Promise.all([g.waitForURL("**/start?step=4"), g.click('button:has-text("Add routine")')]);
    await g.waitForSelector("text=✓ Journaling");
    await g.fill('input[name="name"]', "Pat Partner");
    await g.click('button:has-text("Add person")');
    await g.waitForSelector("text=✓ Pat Partner");
    await Promise.all([g.waitForURL("**/start?step=5"), g.click('a:has-text("Next: start your 30 days")')]);
    await g.waitForSelector("text=I am a leader now. My results come through other people.");
    // 5. the 30 days
    await Promise.all([g.waitForURL(/\/cycle\/new\?pillar=E/), g.click('a:has-text("start my 30 days")')]);
    await g.fill('input[name="focus"]', "Pause before I answer");
    await Promise.all([g.waitForURL("**/cycle"), g.click('button:has-text("Start the cycle")')]);
    await g.goto(`${BASE}/start`);
    await g.waitForSelector("text=You are set up");
    await g.goto(`${BASE}/dashboard`);
    // only the F line was written, so the bar keeps FORGE lines open as a nudge for the first week
    assert.equal(await g.locator('nav[aria-label="Your journey"] >> text=(done)').count(), 4);
    await g.waitForSelector('nav[aria-label="Your journey"] >> text=Still open: FORGE identity');
    await gc.close();
  });

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

  await check("9c. what the coach assigns shows on the client's Today screen", async () => {
    const assign = page.locator("form", { hasText: "From the program" });
    await assign.locator('select[name="exerciseRef"]').selectOption({ index: 1 });
    await assign.locator('button:has-text("Assign")').click();
    await page.waitForSelector("text=assigned >> nth=0");
    const sched = page.locator("form", { has: page.locator('input[name="scheduledAt"]') });
    const when = new Date(Date.now() + 5 * 864e5); when.setHours(10, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    await sched.locator('input[name="scheduledAt"]').fill(`${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T10:00`);
    await sched.locator('textarea[name="agenda"]').fill("E2E agenda: review the pause");
    await sched.locator('button:has-text("Schedule")').click();
    await page.waitForSelector("text=E2E agenda: review the pause");
    const dc = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const dp: Page = await dc.newPage();
    await login(dp, "dana@demo.bothhands.app");
    await dp.goto(`${BASE}/dashboard`);
    const box = dp.locator("section", { hasText: "From your coach" });
    await box.waitFor();
    assert.ok((await box.innerText()).includes("Session with Avery Lin"));
    assert.ok((await box.innerText()).includes("Agreed"));
    assert.ok((await box.innerText()).includes("Due"), "the exercise shows with its due date");
    await box.screenshot({ path: `${shots}/09c-from-coach.png` });
    // a client with no coach items sees no box
    await dp.context().clearCookies();
    await login(dp, "marcus@demo.bothhands.app");
    await dp.goto(`${BASE}/dashboard`);
    assert.equal(await dp.locator("text=From your coach").count(), 0);
    await dc.close();
  });

  await check("9d. Identity shift sharing is the client's choice; the coach sees nothing until it is on", async () => {
    const dc = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const dp: Page = await dc.newPage();
    await login(dp, "dana@demo.bothhands.app");
    await dp.goto(`${BASE}/identity`);
    await dp.fill('textarea[name="claim"]', "E2E-ID: a manager who makes hard calls on time.");
    await dp.locator("label", { hasText: "Identity reinvention" }).click();
    await dp.locator("summary", { hasText: "Create a performance identity" }).click();
    await dp.fill('input[name="personaName"]', "E2E-PERSONA");
    await Promise.all([dp.waitForURL("**/identity?saved=1"), dp.click('button:has-text("Save my identity shift")')]);
    await page.goto(`${BASE}/coach/${dana.id}`);
    assert.ok(!(await page.content()).includes("E2E-ID"), "not visible before the client shares");
    await dp.goto(`${BASE}/sharing`);
    await Promise.all([dp.waitForLoadState("networkidle"), dp.click('button[aria-label^="Share: Identity shift"]')]);
    await dp.waitForSelector('button[aria-label^="Stop sharing: Identity shift"]');
    await page.goto(`${BASE}/coach/${dana.id}`);
    await page.waitForSelector("text=E2E-ID: a manager who makes hard calls on time.");
    assert.ok(!(await page.content()).includes("E2E-PERSONA"), "persona needs its own tick");
    await dp.goto(`${BASE}/identity`);
    await dp.locator("summary", { hasText: "AI companion and sharing" }).click();
    await dp.locator('input[name="sharePersona"]').check();
    await dp.locator('input[value="SUPPORTIVE"]').check();
    await Promise.all([dp.waitForLoadState("networkidle"), dp.click('button:has-text("Save these settings")')]);
    const row = await db.identityProfile.findUniqueOrThrow({ where: { userId: dana.id } });
    assert.equal(row.tone, "SUPPORTIVE", "tone override saved independently of the level");
    assert.equal(row.level, "REINVENT");
    await page.goto(`${BASE}/coach/${dana.id}`);
    await page.waitForSelector("text=E2E-PERSONA");
    await dc.close();
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
    await page.waitForSelector("text=0 of 8 areas shared");
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
