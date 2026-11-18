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
import { hashPassword } from "../../src/lib/password";

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
/** Rate the five rules on the one-page self-assessment: each rule is a section that opens to its five levels. */
const rate = async (page: Page, scores: Record<string, number>) => {
  for (const [k, v] of Object.entries(scores)) {
    await page.locator(`details[data-rule="${k}"]`).evaluate((d) => { (d as HTMLDetailsElement).open = true; });
    await page.locator(`input[name="${k}"][value="${v}"]`).check({ force: true });
  }
};
const logout = async (page: Page) => {
  await page.context().clearCookies();
};
/** Who I am saves through the statement reveal: the button opens the full statement, and Save is on that screen. */
const saveThroughReveal = async (page: Page, url: string, button = "Save who I am") => {
  await page.click(`button:has-text("${button}")`);
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor();
  await Promise.all([page.waitForURL(url), dialog.locator('button:has-text("Save")').click()]);
};
/** Week 1 setup: five answers, the plan, then one person who finds out. Returns the plan text. */
const doSetup = async (page: Page, who: string, newResponse = "Pause and ask one question before I answer", landing = "**/dashboard?setup=done") => {
  await page.waitForURL(/\/cycle\/setup\?step=1$/);
  const answers = ["When someone pushes back on my decision in a meeting", "Heat in my chest", "I defend the decision right away", newResponse, "Letting go of needing to look like I have the answer"];
  for (let i = 0; i < 5; i++) {
    await page.fill('textarea[name="value"]', answers[i]);
    assert.ok(await page.locator("text=First guess").count(), "every answer is a first guess");
    await Promise.all([page.waitForURL(i < 4 ? new RegExp(`step=${i + 2}$`) : /step=plan$/), page.click('button:has-text("Next")')]);
  }
  const plan = await page.inputValue('textarea[name="plan"]');
  assert.equal(plan, `When someone pushes back on my decision in a meeting and I feel heat in my chest, I will ${newResponse[0].toLowerCase()}${newResponse.slice(1)}.`);
  await Promise.all([page.waitForURL(/step=share$/), page.click('button:has-text("Looks right")')]);
  // No one in My people yet (the first session no longer asks earlier): add them right here.
  if (await page.locator('button:has-text("Add and continue")').count()) {
    await page.fill('input[name="name"]', who);
    await Promise.all([page.waitForLoadState("networkidle"), page.click('button:has-text("Add and continue")')]);
  }
  await page.locator("label", { hasText: who }).first().click();
  const msg = await page.inputValue("textarea");
  assert.ok(msg.endsWith("Check on me.") && !/heat|defend|letting go/i.test(msg), "only the situation and the new response by default");
  await Promise.all([page.waitForURL(landing), page.click('button:has-text("Send by text or email")')]);
  return plan;
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
    // sign-up is a request: the person waits until an administrator approves
    await Promise.all([page.waitForURL("**/login?requested=1"), page.click('button:has-text("Create account")')]);
    await page.waitForSelector("text=Your account is waiting for approval");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "e2e-password-123");
    await page.click('button:has-text("Sign in")');
    await page.waitForSelector("text=waiting for approval. You'll get an email");
    // the administrator approves on the People page
    const ac = await browser.newContext();
    const ap: Page = await ac.newPage();
    await login(ap, "admin@demo.bothhands.app", "demo-password-1");
    await ap.goto(`${BASE}/admin`);
    await ap.waitForSelector("text=waiting for your approval");
    await ap.goto(`${BASE}/admin/people`);
    const row = ap.locator("li", { hasText: email });
    await Promise.all([ap.waitForLoadState("networkidle"), row.locator('button:has-text("Approve")').click()]);
    let approved = await db.user.findUniqueOrThrow({ where: { email } });
    for (let i = 0; i < 25 && approved.status !== "ACTIVE"; i++) { await ap.waitForTimeout(200); approved = await db.user.findUniqueOrThrow({ where: { email } }); }
    assert.equal(approved.status, "ACTIVE");
    assert.ok(approved.orgId, "approval adds them to the organization");
    await ac.close();
    await login(page, email, "e2e-password-123");
    await page.goto(`${BASE}/onboarding`);
    await page.screenshot({ path: `${shots}/01-onboarding.png`, fullPage: true });
    // a new client goes straight into the guided first session; this run takes the full pages instead
    await Promise.all([page.waitForURL("**/start"), page.locator('form:has(input[value="PERSONAL"]) button').click()]);
    await page.waitForSelector("text=Which seat are you in?");
    await page.goto(`${BASE}/assessment`);
  });

  let assessmentUrl = "";
  await check("2. complete a FORGE assessment", async () => {
    await page.waitForSelector('nav[aria-label="Your journey"] >> text=Step 1 of 4');
    // one page: all five rules, each with the client's own line and all five levels in full
    assert.equal(await page.locator('input[type="radio"][name="E"]').count(), 5, "all five levels show up front");
    assert.equal(await page.locator("text=What I wrote").count(), 5, "each rule shows what the client wrote");
    const scores: Record<string, number> = { F: 4, O: 3, R: 4, G: 3, E: 2 };
    await rate(page, scores);
    await page.waitForTimeout(500); // picking a level closes the rule; tap it again to add a reflection
    await page.locator('details[data-rule="E"] > summary').click();
    await page.locator("fieldset", { hasText: "Emotionally Anchored" }).locator("summary", { hasText: "Add a reflection" }).click();
    await page.fill('textarea[name="reflE"]', "When my numbers get questioned in front of my boss, I get sharp.");
    await page.screenshot({ path: `${shots}/02-assessment.png`, fullPage: false });
    await Promise.all([page.waitForURL(/\/assessment\/[a-z0-9]+$/), page.click('button:has-text("See my profile")')]);
    assert.ok(!/in the wild/i.test(await page.locator("main").innerText()), "FORGE in the Wild is retired");
    assessmentUrl = page.url();
    await page.waitForSelector("text=The goal is a 5 on every rule");
    assert.equal(await page.locator("text=/ 25").count(), 0, "no total, no grade");
    assert.equal(await page.locator("text=Full behavioral anchor tables").count(), 0, "no second rating page");
    // update the ratings from the profile, on the same one-page form
    await Promise.all([page.waitForURL(/\?edit=1$/), page.click('a:has-text("Update my ratings")')]);
    assert.ok(await page.locator('input[name="E"][value="2"]').isChecked(), "the form opens with the current ratings");
    await Promise.all([page.waitForURL(/\?updated=1$/), page.click('button:has-text("Save my ratings")')]);
    await page.waitForSelector("text=Your ratings are updated");
    await page.waitForSelector("text=My updated ratings");
    await page.goto(assessmentUrl);
    await page.screenshot({ path: `${shots}/03-profile.png`, fullPage: true });
  });

  await check("3. identify a development priority", async () => {
    // Choosing a focus from the results leads to My focus, starting from the lowest score.
    await Promise.all([page.waitForURL(/\/cycle\/new\?pillar=E$/), page.click('button:has-text("choose my focus")')]);
    // the old plan address now opens Who I am: one activity
    await Promise.all([page.waitForURL("**/identity"), page.goto(`${BASE}/plan`)]);
    const p = await db.profile.findFirst({ where: { user: { email } } });
    assert.equal(p?.priorityPillar, "E");
    await page.locator('button:has-text("manager")').first().click();
    assert.equal(await page.inputValue('input[name="role"]'), "manager");
    await page.locator("label", { hasText: "Core alignment" }).click();
    await page.fill('textarea[name="destination"]', "a leader my team trusts with bad news");
    await page.fill('textarea[name="lineO"]', "a discerning leader who sees what my team needs");
    // the reveal: with no statement yet, it starts from the five, fills the screen, and Save is there
    await page.click('button:has-text("Save who I am")');
    const reveal = page.locator('[role="dialog"]');
    await reveal.locator("text=This is who's behind the wheel.").waitFor();
    assert.ok((await reveal.innerText()).includes("I am a leader my team trusts with bad news. I am a discerning leader who sees what my team needs."));
    assert.equal(await page.locator('button:has-text("Put my five together")').count(), 0, "one button for the statement");
    await Promise.all([page.waitForURL("**/identity?saved=1"), reveal.locator('button:has-text("Save")').click()]);
    const saved = await db.profile.findFirstOrThrow({ where: { user: { email } } });
    assert.equal(saved.destination, "I am a leader my team trusts with bad news");
    assert.equal(saved.lineO, "I am a discerning leader who sees what my team needs");
    const id = await db.identityProfile.findFirstOrThrow({ where: { user: { email } } });
    assert.equal(id.role, "manager");
    assert.equal(id.becoming, saved.forgeStatement, "one statement, stored where every screen reads it");
    // the five questions now carry the role
    await page.waitForSelector("text=As a manager, who is the person I'm driving toward?");
    // FORGE is taught on the page: the opening, each rule from the book, and what this means with the research
    await page.waitForSelector("text=You only ever rise to the level of who you believe you are.");
    assert.equal(await page.locator("h1", { hasText: "Who's behind the wheel" }).count(), 1);
    await page.waitForSelector("text=Know your destination.");
    assert.equal(await page.locator('summary:has-text("What this means")').count(), 5, "every letter teaches before it asks");
    const f = page.locator("section#f");
    await f.locator('summary:has-text("What this means")').click();
    await f.locator("text=possible selves").waitFor();
    assert.ok(!(await f.innerText()).includes("Steve Jobs"));
    // the assessment reads the scores against the identity the client claimed
    await page.goto(`${BASE}/assessment`);
    await page.waitForSelector("text=Rate yourself as a manager");
    await page.goto(`${BASE}/identity`);
  });

  await check("4. create My road (Discipline by Design)", async () => {
    // the old address still lands on My road
    await page.goto(`${BASE}/blueprint`);
    await page.waitForURL("**/road");
    await page.goto(`${BASE}/road`);
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
    const weekly = page.locator("section", { hasText: "Weekly planning and reflection" });
    await weekly.locator("summary", { hasText: "Add to this area" }).click();
    await weekly.locator('input[name="title"]').fill("Plan the week ahead");
    await weekly.locator('select[name="whenDays"]').selectOption("Sunday");
    await Promise.all([page.waitForLoadState("networkidle"), weekly.locator('button[type="submit"]:has-text("Add")').click()]);
    await page.waitForSelector("text=Plan the week ahead");
    // the map: the client in the middle, and only what they have added around them
    await page.waitForSelector('svg[aria-label="My Design: 2 things around you"]');
    assert.equal(await page.locator('svg[aria-label^="My Design"] a').count(), 2, "no empty category slots");
    assert.equal(await page.locator("text=Chapter 10").count(), 0, "no chapter numbers");
    await page.screenshot({ path: `${shots}/04-my-road.png`, fullPage: false });
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

  await check("6. start a 30-day development cycle: week 1 setup, then who finds out", async () => {
    // the phone's share sheet, stubbed: the message is what the client would send
    await page.addInitScript(() => { (navigator as unknown as { share: (d: { text: string }) => Promise<void> }).share = async () => {}; });
    await page.goto(`${BASE}/cycle/new`);
    assert.equal(await page.locator('input[name="focus"][type="text"]').count(), 0, "the behavior box is gone: week 1 setup names it");
    assert.ok(await page.locator('input[name="pillar"][value="E"]').isChecked(), "ideas start from the lowest score");
    assert.equal(await page.locator("text=watch area").count(), 0, "no watch area");
    await page.fill('input[name="title"]', "Stay curious when my decisions get challenged");
    await page.click('button:has-text("Start my 30 days")');
    const plan = await doSetup(page, "Jamie Cole");
    await page.waitForSelector("text=Your focus is set up");
    const c = await db.developmentCycle.findFirstOrThrow({ where: { user: { email }, status: "ACTIVE" } });
    assert.equal(c.plan, plan);
    assert.equal(c.focus, "Pause and ask one question before I answer", "the coach's Practice view sees the new response, never the feeling");
    assert.ok(c.setupDoneAt && c.partnerId, "setup is done once someone finds out");
    assert.equal(JSON.parse(c.firstGuess).feeling, "Heat in my chest");
    assert.equal(c.shareFeeling || c.shareOld || c.shareGap, false);
    await page.waitForSelector(`text=${plan}`);
    await page.goto(`${BASE}/cycle`);
    await page.waitForSelector("text=Day 1 of 30");
    await page.waitForSelector("text=My plan for 30 days");
    await page.waitForSelector("text=Jamie checks on me.");
    // the journey bar follows: all four steps done, and the 30 days under way
    await page.goto(`${BASE}/road`);
    const bar = page.locator('nav[aria-label="Your journey"]');
    await bar.locator("text=Day 1 of 30").waitFor();
    assert.equal(await bar.locator("text=(done)").count(), 4, "Who I am, Where I am, My road and 30 days");
  });

  await check("7. record a daily reflection", async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.locator('input[name="status"][value="DONE"]').check({ force: true });
    await page.locator("summary:has-text('Add detail')").click();
    await page.locator('label:has(input[name="tags"][value="In a meeting"])').click();
    assert.ok(await page.locator('input[name="tags"][value="In a meeting"]').isChecked());
    await page.fill('input[name="note"]', "Paused in the 10 am review");
    await page.fill('textarea[name="reflection"]', "E2E-REFLECTION-TEXT: the pause gave me room.");
    await submitAndWait(page, 'button:has-text("Save my daily check-in")');
    await page.screenshot({ path: `${shots}/06-dashboard.png`, fullPage: true });
  });

  await check("7a. weekly reflection with My road checkboxes, no essay required", async () => {
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

  await check("7b. My focus: one or two, and that's it; My road holds it", async () => {
    await page.goto(`${BASE}/focus`);
    await page.waitForSelector("text=Stay curious when my decisions get challenged");
    await page.waitForSelector("text=Add a second focus");
    await page.goto(`${BASE}/road`);
    // the design is built around the whole identity; the focus is one part of it
    await page.waitForSelector("text=Built around who I am");
    await page.waitForSelector("text=Your focus right now is one part of it");
    assert.equal(await page.locator("text=One move this week").count(), 0, "one move is folded into My focus");
    // a second focus fills slot 2; a third has to replace one
    await page.goto(`${BASE}/cycle/new`);
    assert.ok(await page.locator('input[name="pillar"][value="O"]').isChecked(), "a second focus starts from the lowest rule not already in use");
    await page.locator('label:has(input[name="pillar"][value="G"])').click();
    await page.waitForSelector("text=Ideas for Growth Oriented");
    assert.equal(await page.locator("text=Ideas for Outcome Aware").count(), 0, "the ideas follow the rule picked");
    await page.fill('input[name="title"]', "Give my team the full picture, early");
    await Promise.all([page.waitForURL(/\/cycle\/setup\?step=1$/), page.click('button:has-text("Start my 30 days")')]);
    const two = await db.developmentCycle.findMany({ where: { user: { email }, status: "ACTIVE" }, orderBy: { slot: "asc" } });
    assert.deepEqual(two.map((c) => c.slot), [1, 2]);
    await page.goto(`${BASE}/cycle/new`);
    await page.waitForSelector("text=You already have two focuses");
    assert.equal(await page.locator('input[name="replace"]').count(), 2);
    // check in on each focus: the second one's status shares the day's row
    await page.goto(`${BASE}/dashboard`);
    // one check-in for the day: both focuses with equal weight, the identity question once, one save
    await page.waitForSelector('input[name="status2"]', { state: "attached" });
    assert.equal(await page.locator('form:has(input[name="status2"]) button[type="submit"]').count(), 1, "one save for the day");
    assert.equal(await page.locator('input[name="identityActed"][value="YES"]').count(), 1, "the identity question is asked once");
    assert.ok(await page.locator('input[name="status"][value="DONE"]').isChecked(), "focus 1's answer from earlier is kept");
    await page.locator('label:has(input[name="status2"][value="PARTIAL"])').click();
    await Promise.all([page.waitForLoadState("networkidle"), page.click('button:has-text("Update my daily check-in")')]);
    let row = await db.dailyCheckIn.findFirst({ where: { user: { email }, cycle2Id: two[1].id } });
    for (let i = 0; i < 25 && !row; i++) { await page.waitForTimeout(200); row = await db.dailyCheckIn.findFirst({ where: { user: { email }, cycle2Id: two[1].id } }); }
    assert.equal(row?.status2, "PARTIAL");
    assert.equal(row?.status, "DONE", "focus 1's check-in from earlier today is untouched");
    await page.screenshot({ path: `${shots}/06b-focus.png`, fullPage: true });
    // leave one focus, as later steps expect
    await db.developmentCycle.update({ where: { id: two[1].id }, data: { status: "STOPPED" } });
  });

  await check("7c. My feedback: own summary and file, private, tagged to a pillar, put to work", async () => {
    // the old EQ-i address lands on My feedback
    await page.goto(`${BASE}/pathway/eqi`);
    await page.waitForURL("**/feedback");
    await Promise.all([page.waitForURL("**/feedback/new"), page.click('a:has-text("Add feedback")')]);
    await page.locator("label", { hasText: "EQ-i 2.0" }).click();
    await page.fill('textarea[name="summary"]', "MY-SUMMARY: I go quiet and then react when a budget gets questioned.");
    await page.setInputFiles('input[name="file"]', { name: "my-notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 my own notes") });
    await page.locator("label", { hasText: "Emotionally Anchored" }).click();
    await page.locator('input[name="ownSummary"]').check();
    await Promise.all([page.waitForURL(/\/feedback\/[a-z0-9]+$/), page.click('button:has-text("Save")')]);
    await page.waitForSelector("text=MY-SUMMARY");
    const fb = await db.feedback.findFirstOrThrow({ where: { user: { email } } });
    assert.equal(fb.shareCoach || fb.allowAi, false, "private, and off for the AI, by default");
    assert.equal(fb.ownSummary, true);
    const file = await page.request.get(`${BASE}/feedback/${fb.id}/file`);
    assert.equal(file.status(), 200);
    assert.equal(file.headers()["content-type"], "application/pdf");
    // a priority from it, put to work
    const add = page.locator("form", { hasText: "What I'm working on" });
    await add.locator('input[name="label"]').fill("Impulse control in budget meetings");
    await add.locator('select[name="pillar"]').selectOption("E");
    await add.locator('input[name="practice"]').fill("One breath before I answer");
    await Promise.all([page.waitForLoadState("networkidle"), add.locator('button:has-text("Add")').click()]);
    await page.waitForSelector("text=Make this a focus");
    assert.equal(await page.locator('button:has-text("Share with")').count(), 0, "no share button without a coach");
    await Promise.all([page.waitForURL("**/road"), page.click('button:has-text("Add to My Design")')]);
    await page.waitForSelector("text=One breath before I answer");
    // the AI switch turns on for this entry only
    await page.goto(`${BASE}/feedback/${fb.id}`);
    await Promise.all([page.waitForLoadState("networkidle"), page.click('button[aria-label="Let Help me with this use my summary"]')]);
    await page.waitForSelector('button[aria-label="Let Help me with this use my summary"][aria-checked="true"]');
    // practicing it for 30 days warns that the current 30 days would end
    await Promise.all([page.waitForURL(/\/cycle\/new\?pillar=E/), page.click('a:has-text("Make this a focus")')]);
    assert.equal(await page.inputValue('input[name="focus"]'), "One breath before I answer");
    assert.ok(await page.locator('input[name="pillar"][value="E"]').isChecked());
    assert.equal(await page.inputValue('input[name="source"]'), "FEEDBACK");
    // one focus is in progress, so this one can be a second focus: nothing ends
    await page.waitForSelector('button:has-text("Start my 30 days")');
    assert.equal(await page.locator('input[name="replace"]').count(), 0);
    // the results page says where the feedback points, and that it is a different measure
    const a = await db.assessment.findFirstOrThrow({ where: { user: { email } }, orderBy: { completedAt: "desc" } });
    await page.goto(`${BASE}/assessment/${a.id}`);
    await page.waitForSelector("text=My feedback points to Emotionally Anchored");
    await page.waitForSelector("text=It isn't the same measure as your FORGE scores.");
  });

  await check("7e. Who I am: three equal kinds, one statement on Today, behavior on My road, history kept", async () => {
    const me = await db.user.findUniqueOrThrow({ where: { email } });
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector(`main a:has-text("Who's behind the wheel, as a manager") >> text=I am a leader my team trusts with bad news.`);
    await page.goto(`${BASE}/identity`);
    assert.ok(!(await page.content()).includes("Identity shift"), "one activity, one name");
    for (const name of ["Core alignment", "Role transition", "Reinvention"]) await page.locator("label", { hasText: name }).click();
    await page.locator("label", { hasText: "Core alignment" }).click();
    assert.ok(!(await page.locator('input[name="personaName"]').isVisible()), "the performance identity folds under identity reinvention only");
    await page.fill('textarea[name="statement"]', "someone who follows through on what I say.");
    await saveThroughReveal(page, "**/identity?saved=1");
    const id = await db.identityProfile.findUniqueOrThrow({ where: { userId: me.id } });
    assert.equal(id.becoming, "I am someone who follows through on what I say.");
    assert.equal((await db.profile.findUniqueOrThrow({ where: { userId: me.id } })).forgeStatement, id.becoming);
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector(`main a:has-text("Who's behind the wheel") >> text=I am someone who follows through on what I say.`);
    // My road starts from the statement and holds the focus: no separate behavior to track
    await page.goto(`${BASE}/road`);
    await page.waitForSelector("text=Built around who I am");
    assert.equal(await page.locator('input[name="behavior"]').count(), 0);
    // identity reinvention, with the folded performance identity
    await page.goto(`${BASE}/identity`);
    await page.locator("label", { hasText: "Reinvention" }).click();
    await page.locator("summary", { hasText: "Create a performance identity" }).click();
    await page.fill('input[name="personaName"]', "The Closer");
    await page.fill('textarea[name="personaStandards"]', "I finish what I start.");
    await saveThroughReveal(page, "**/identity?saved=1");
    await page.waitForSelector("text=Earlier versions");
    const hist = await db.identityHistory.findMany({ where: { userId: me.id } });
    assert.equal(hist.length, 2);
    assert.ok(hist.every((h) => h.level === "CORE" && h.role === "manager"));
    assert.equal(await db.assessment.count({ where: { userId: me.id } }), 1, "FORGE records untouched");
    assert.equal(await db.developmentCycle.count({ where: { userId: me.id, status: "ACTIVE" } }), 1, "the focus in progress is untouched");
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector("text=The Closer");
    await page.screenshot({ path: `${shots}/06e-identity-card.png` });
    const priority = await db.profile.findUniqueOrThrow({ where: { userId: me.id } });
    assert.equal(priority.priorityPillar, "E", "choosing a kind of change never changes the FORGE priority");
  });

  await check("7f. who I am is asked every day; the weekly look back doesn't ask it again", async () => {
    const me = await db.user.findUniqueOrThrow({ where: { email } });
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector("text=Showed up as who I am?");
    await page.locator('label:has(input[name="identityActed"][value="PARTLY"])').click();
    await submitAndWait(page, 'button:has-text("Update my daily check-in")');
    let ci = await db.dailyCheckIn.findFirst({ where: { userId: me.id, identityActed: "PARTLY" } });
    for (let i = 0; i < 25 && !ci; i++) { await page.waitForTimeout(200); ci = await db.dailyCheckIn.findFirst({ where: { userId: me.id, identityActed: "PARTLY" } }); }
    assert.ok(ci, "the daily answer is saved");
    await page.goto(`${BASE}/reflect`);
    assert.equal(await page.locator('input[name="actedLike"]').count(), 0, "not asked twice");
    assert.equal(await page.locator("text=watch area").count(), 0, "no watch area");
  });

  await check("7g. Set the Tone: with myself and with someone else; limited language counted; lines kept; private", async () => {
    await page.goto(`${BASE}/tone`);
    // the book's own self-talk questions, when the licensed content is installed
    if (fs.existsSync("src/content/licensed/pack.json")) await page.waitForSelector('section[aria-label="From the book"] p.font-serif');
    await page.fill('textarea[name="said"]', "E2E-TONE: I can't run this meeting. That's just how I am.");
    await Promise.all([page.waitForURL(/\/tone\?entry=/), page.click('button:has-text("Rewrite it")')]);
    await page.waitForSelector('h2:text-is("Limited language")');
    await page.waitForSelector("text=Say this instead");
    await page.waitForSelector("text=I'll try.");
    await page.waitForSelector("text=That's how I've handled it so far.");
    await page.waitForSelector("text=Your words are instructions.");
    // the three-day audit counts it
    const audit = page.locator("section:has(h2:has-text('The last three days'))");
    assert.ok((await audit.innerText()).includes("1 time"));
    // keep a line of my own, sorted by the three Cs
    await page.locator("summary:has-text('Add a line of your own')").click();
    await page.fill('input[name="line"]', "E2E-LINE: I am the calm one in the room.");
    await page.locator('details:has(input[name="line"]) select[name="kind"]').selectOption("CONFIRM");
    await Promise.all([page.waitForURL(/kept=1/), page.locator('details:has(input[name="line"]) button:has-text("Keep it")').click()]);
    await page.waitForSelector("text=E2E-LINE: I am the calm one in the room.");
    // counting check-ins too is the client's choice, off until they turn it on
    assert.equal((await db.profile.findFirstOrThrow({ where: { user: { email } } })).toneReadsWriting, false);
    await Promise.all([page.waitForLoadState("networkidle"), page.click('button:has-text("Also count my check-ins and look backs")')]);
    await page.waitForSelector("text=Also counting your check-in notes");
    // distress stops the coaching and points to support
    await page.fill('textarea[name="said"]', "E2E-TONE: some days I want to die");
    await Promise.all([page.waitForURL(/care=1/), page.click('button:has-text("Rewrite it")')]);
    await page.waitForSelector("text=988");
    assert.equal(await page.locator('h2:text-is("Limited language")').count(), 0, "no coaching on distress");
    // with someone else: how do I say it
    await page.goto(`${BASE}/tone`);
    await Promise.all([page.waitForURL(/mode=others/), page.click('nav[aria-label="Set the Tone mode"] a:has-text("With someone else")')]);
    await page.fill('input[name="who"]', "E2E-WHO my direct report");
    await page.fill('textarea[name="situation"]', "E2E-SITUATION: they missed the deadline again");
    await page.fill('textarea[name="tempted"]', "You didn't do this again. What's wrong with you?");
    await Promise.all([page.waitForURL(/\/tone\?entry=/), page.click('button:has-text("How do I say it?")')]);
    await page.waitForSelector("text=Before you talk with E2E-WHO my direct report");
    await page.waitForSelector("text=E2E-SITUATION: they missed the deadline again");
    // each mode keeps to itself: no self-talk count or lines under a conversation
    assert.equal(await page.locator("h2:has-text('The last three days')").count(), 0);
    assert.equal(await page.locator("h2:has-text('My lines')").count(), 0);
    await page.waitForSelector("summary:has-text('Earlier conversations (1)')");
    const saved = await db.toneEntry.findFirstOrThrow({ where: { user: { email }, mode: "OTHERS" } });
    assert.equal(saved.who, "E2E-WHO my direct report");
    // conversations don't count toward the self-talk tally
    await page.goto(`${BASE}/tone`);
    assert.ok((await page.locator("section:has(h2:has-text('The last three days'))").innerText()).includes("1 time"));
    // one tap from the round + button
    await page.goto(`${BASE}/companion`);
    await page.waitForSelector('main a[href="/tone"]:has-text("Set the Tone")');
  });

  await check("1b/7d. sign out, sign back in, saved progress and reflection retrieved", async () => {
    await logout(page);
    await login(page, email, "e2e-password-123");
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector('button:has-text("Update my daily check-in")');
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
    const gEmail = await g.inputValue('input[name="email"]');
    await Promise.all([g.waitForURL("**/login?requested=1"), g.click('button:has-text("Create account")')]);
    await db.user.update({ where: { email: gEmail }, data: { status: "ACTIVE" } }); // approved (the approval itself is tested in step 1)
    await login(g, gEmail, "e2e-password-123");
    await g.goto(`${BASE}/onboarding`);
    await Promise.all([g.waitForURL("**/start"), g.locator('form:has(input[value="LEADING_OTHERS"]) button').click()]);
    // 1. who I am, part 1: the role and the kind of change
    await g.locator('button:has-text("manager")').first().click();
    await g.locator("label", { hasText: "Role transition" }).click();
    await Promise.all([g.waitForURL("**/start?step=1&part=2"), g.click('button:has-text("Save and continue")')]);
    // part 2: the five sides carry the role, and the examples match it (the newly promoted manager first)
    await g.waitForSelector("text=As a manager, who is the person I'm driving toward?");
    // examples stay folded under Examples, closest person first (the newly promoted manager); tapping one fills the box
    assert.equal(await g.locator("text=For example").count(), 0, "no example line under the questions");
    await g.locator('summary:has-text("Examples")').first().click();
    await g.waitForSelector("text=Newly promoted manager · role transition");
    await g.locator('button:has-text("a manager measured by what my team can do.")').first().click();
    assert.equal(await g.inputValue('textarea[name="destination"]'), "a manager measured by what my team can do.");
    await Promise.all([g.waitForURL("**/start?step=1&part=3"), g.click('button:has-text("Save and continue")')]);
    // part 3: one statement
    assert.ok((await g.inputValue('textarea[name="statement"]')).startsWith("I am "), "the statement starts from the five lines");
    await saveThroughReveal(g, "**/start?step=2", "Save and continue");
    // 2. where I am: the self-assessment is inside the kickoff; the client never leaves it
    await rate(g, { F: 4, O: 3, R: 4, G: 3, E: 2 });
    await Promise.all([g.waitForURL("**/start?step=2&scored=1"), g.click('button:has-text("See my profile")')]);
    await g.waitForSelector("text=The goal is a 5 on every one");
    assert.equal(await g.locator("text=/ 25").count(), 0, "no total");
    await Promise.all([g.waitForURL("**/start?step=3"), g.click('a:has-text("Next: choose your focus")')]);
    // 3. my focus: named right here (no seat, season or start date), then five questions, the plan, who finds out
    assert.equal(await g.locator('input[name="season"][type="checkbox"]').count(), 0, "no season in the kickoff");
    // the phone's share sheet, stubbed, and loaded with a full page load so it is in place for week 1 setup
    await g.addInitScript(() => { (navigator as unknown as { share: () => Promise<void> }).share = async () => {}; });
    await g.reload();
    await g.fill('input[name="title"]', "Stay curious when my decisions get challenged");
    assert.ok(await g.locator('input[name="pillar"][value="E"]').isChecked(), "starts from the lowest score");
    await Promise.all([g.waitForURL(/\/cycle\/setup\?step=1$/), g.click('button:has-text("Next: five short questions")')]);
    await g.waitForSelector("text=Step 3 of 4 · question 1 of 5");
    await doSetup(g, "Pat Partner", "Pause before I answer", "**/start?step=4");
    // 4. build the system, one screen each: a daily routine, a weekly planning time, an accountability partner
    await g.waitForSelector("text=Kickoff · Step 4 of 4, part 1 of 3");
    await g.goto(`${BASE}/dashboard`);
    await g.waitForSelector("text=Build your system first");
    assert.equal(await g.locator('button:has-text("Save my daily check-in")').count(), 0, "no check-in until the system is built");
    await g.goto(`${BASE}/start?step=4`);
    await g.locator('summary:has-text("Ideas")').click();
    await g.locator('button:has-text("Journaling")').click();
    await Promise.all([g.waitForURL(/\/start\?step=4&saved=routines$/), g.click('button:has-text("Add daily routine")')]);
    await g.waitForSelector("text=Kickoff · Step 4 of 4, part 2 of 3");
    await Promise.all([g.waitForURL(/\/start\?step=4&saved=weekly$/), g.click('button:has-text("Add weekly planning time")')]);
    // Pat came in as the accountability partner who finds out, so the third piece is already in place
    await g.waitForSelector("text=Your system is set up.");
    await g.waitForSelector('a:has-text("An accountability partner")');
    await g.click('a:has-text("Finish and go to Today")');
    await g.waitForSelector('button:has-text("Save my daily check-in")');
    // for the season checks below: make this month 1 of a season, started 29 days ago, so today is day 30
    {
      const gu = await db.user.findFirstOrThrow({ where: { name: "Guided Driver (E2E)" }, orderBy: { createdAt: "desc" } });
      const season = await db.season.create({ data: { userId: gu.id, startStatement: "I am a manager measured by what my team can do." } });
      const c = await db.developmentCycle.findFirstOrThrow({ where: { userId: gu.id, status: "ACTIVE" } });
      const ago = new Date(Date.now() - 29 * 86400000); ago.setHours(0, 0, 0, 0);
      await db.developmentCycle.update({ where: { id: c.id }, data: { seasonId: season.id, seasonMonth: 1, startDate: ago } });
    }
    await g.goto(`${BASE}/cycle`);
    await g.waitForSelector("text=Season, month 1 of 3");
    // day 30 of a set-up cycle: week 4 asks what keeps it going, and can put it on My road
    await g.goto(`${BASE}/reflect`);
    await g.waitForSelector("text=What keeps this going after day 30?");
    await g.fill('textarea[name="look_keep"]', "A sticky note on my laptop");
    await g.locator('input[name="look_routine"]').check();
    await Promise.all([g.waitForLoadState("networkidle"), g.click('button:has-text("Save this week")')]);
    await g.waitForSelector("text=Send this to Pat?");
    const gid = (await db.user.findFirstOrThrow({ where: { name: "Guided Driver (E2E)" }, orderBy: { createdAt: "desc" } })).id;
    assert.ok(await db.commitment.findFirst({ where: { userId: gid, title: "A sticky note on my laptop", detail: "From my 30 days" } }), "week 4 puts it on My road");
    await g.click('button:has-text("Not this week")');
    await g.waitForSelector("text=Send this to Pat?", { state: "detached" });
    // day 30 offers to send the statement and the result to the same person
    await g.goto(`${BASE}/cycle`);
    await g.waitForSelector("text=Send your 30 days to Pat?");
    await g.goto(`${BASE}/start`);
    await g.waitForSelector("text=You are set up");
    await g.goto(`${BASE}/dashboard`);
    assert.equal(await g.locator('nav[aria-label="Your journey"] >> text=(done)').count(), 4, "all four steps done");
    assert.equal((await db.developmentCycle.findFirstOrThrow({ where: { user: { name: "Guided Driver (E2E)" } }, orderBy: { createdAt: "desc" } })).role, "manager", "the 30 days keep the role");
    await gc.close();
  });

  await check("1d. a 90-day season: day 30 leads into month 2, then the season review", async () => {
    const gc = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const g: Page = await gc.newPage();
    const guided = await db.user.findFirstOrThrow({ where: { name: "Guided Driver (E2E)" }, orderBy: { createdAt: "desc" } });
    await login(g, guided.email, "e2e-password-123");
    await g.goto(`${BASE}/cycle`);
    // month 1, day 30: only the season choices are offered
    assert.equal(await g.locator('input[name="decision"][value="CONTINUE_ALONE"]').count(), 0);
    await g.locator('input[name="decision"][value="NEXT_SAME"]').check();
    await Promise.all([g.waitForURL(/\/cycle\/new\?season=continue/), g.click('button:has-text("Finish these 30 days")')]);
    await g.waitForSelector("text=Month 2 of 3 in my season");
    assert.equal(await g.inputValue('input[name="focus"]'), "Pause before I answer", "same pillar carries the behavior over");
    await Promise.all([g.waitForURL(/\/cycle\/setup\?step=1$/), g.click('button:has-text("Start my 30 days")')]);
    // month 2 starts from month 1's week 1 answers, to review and send again
    assert.equal(await g.inputValue('textarea[name="value"]'), "When someone pushes back on my decision in a meeting");
    await g.waitForSelector("text=From last month. Change it if it's different now.");
    const m2 = await db.developmentCycle.findFirstOrThrow({ where: { userId: guided.id, seasonMonth: 2 } });
    assert.ok(m2.plan && m2.partnerId && !m2.setupDoneAt, "the plan and the person carry over; setup is done when it is sent again");
    await g.goto(`${BASE}/cycle`);
    await g.waitForSelector("text=Season, month 2 of 3");
    const cycles = await db.developmentCycle.findMany({ where: { userId: guided.id }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(cycles.map((c) => c.seasonMonth), [1, 2]);
    assert.equal(cycles[0].seasonId, cycles[1].seasonId, "both months are in one season");
    // the review: month rows, then close the season
    await g.goto(`${BASE}/season`);
    await g.waitForSelector("text=Month 2 · Emotionally Anchored");
    await g.waitForSelector("text=Take the self-assessment");
    await g.waitForSelector("text=The review opens when month 2 ends.");
    assert.equal(await g.locator('input[name="decision"][value="KEEP_GOING"]').count(), 0, "no closing the season mid-month");
    // jump month 2 to its day 30, then end the season there
    await db.developmentCycle.update({ where: { id: cycles[1].id }, data: { startDate: new Date(Date.now() - 29 * 86400000) } });
    await g.goto(`${BASE}/cycle`);
    await g.locator('input[name="decision"][value="END_SEASON"]').check();
    await Promise.all([g.waitForURL("**/season"), g.click('button:has-text("Finish these 30 days")')]);
    await g.locator('input[name="decision"][value="KEEP_GOING"]').check();
    await Promise.all([g.waitForURL("**/dashboard"), g.click('button:has-text("Close the season")')]);
    const season = await db.season.findFirstOrThrow({ where: { userId: guided.id } });
    assert.equal(season.status, "COMPLETED");
    assert.equal(season.decision, "KEEP_GOING");
    assert.equal(await db.developmentCycle.count({ where: { userId: guided.id, status: "ACTIVE" } }), 0, "the open month ends with the season");
    await gc.close();
  });

  await check("1e. start over: the client erases their own records and begins again", async () => {
    const gc = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const g: Page = await gc.newPage();
    const guided = await db.user.findFirstOrThrow({ where: { name: "Guided Driver (E2E)" }, orderBy: { createdAt: "desc" } });
    assert.ok((await db.assessment.count({ where: { userId: guided.id } })) > 0, "has records before");
    await login(g, guided.email, "e2e-password-123");
    await g.goto(`${BASE}/settings`);
    await g.locator("summary", { hasText: "Start over" }).click();
    await g.fill('input[name="confirm"]', "yes");
    await g.click('button:has-text("Erase everything and start over")');
    await g.waitForSelector('text=Type "start over" to confirm.');
    assert.ok((await db.assessment.count({ where: { userId: guided.id } })) > 0, "nothing erased without the words");
    await g.fill('input[name="confirm"]', "Start over");
    await Promise.all([g.waitForURL("**/onboarding"), g.click('button:has-text("Erase everything and start over")')]);
    const counts = await Promise.all([
      db.assessment.count({ where: { userId: guided.id } }),
      db.developmentCycle.count({ where: { userId: guided.id } }),
      db.season.count({ where: { userId: guided.id } }),
      db.commitment.count({ where: { userId: guided.id } }),
      db.relationship.count({ where: { ownerId: guided.id } }),
      db.identityProfile.count({ where: { userId: guided.id } }),
    ]);
    assert.deepEqual(counts, [0, 0, 0, 0, 0, 0]);
    const p = await db.profile.findUniqueOrThrow({ where: { userId: guided.id } });
    assert.equal(p.onboardedAt, null);
    assert.equal(p.destination, "");
    assert.ok(await db.auditEvent.findFirst({ where: { actorId: guided.id, action: "participant.start_over" } }), "logged");
    // the login still works, and the client goes back through the guided session
    await Promise.all([g.waitForURL("**/start"), g.locator('form:has(input[value="PERSONAL"]) button').click()]);
    await g.waitForSelector("text=Which seat are you in?");
    await gc.close();
  });

  await check("1f. forgot password: an emailed link resets it once, and the reply never reveals who has an account", async () => {
    const gc = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const g: Page = await gc.newPage();
    const guided = await db.user.findFirstOrThrow({ where: { name: "Guided Driver (E2E)" }, orderBy: { createdAt: "desc" } });
    await g.goto(`${BASE}/login`);
    await Promise.all([g.waitForURL("**/forgot"), g.click('a:has-text("Forgot your password?")')]);
    const outbox = process.env.EMAIL_DEV_OUTBOX;
    if (!outbox) {
      await g.fill('input[name="email"]', guided.email);
      await g.click('button:has-text("Send me a link")');
      await g.waitForSelector("text=Ask your coach to reset your password.");
      await gc.close();
      return;
    }
    const sentBefore = fs.existsSync(outbox) ? fs.readFileSync(outbox, "utf8").trim().split("\n").filter(Boolean).length : 0;
    // an unknown email gets the same reply, and no email goes out
    await g.fill('input[name="email"]', "nobody-here@example.test");
    await g.click('button:has-text("Send me a link")');
    await g.waitForSelector("text=Check your email");
    assert.equal(fs.existsSync(outbox) ? fs.readFileSync(outbox, "utf8").trim().split("\n").filter(Boolean).length : 0, sentBefore);
    // a real account gets a link
    await g.goto(`${BASE}/forgot`);
    await g.fill('input[name="email"]', guided.email);
    await g.click('button:has-text("Send me a link")');
    await g.waitForSelector("text=Check your email");
    const mail = JSON.parse(fs.readFileSync(outbox, "utf8").trim().split("\n").pop()!);
    assert.equal(mail.to, guided.email);
    const link = (mail.text as string).match(/https?:\/\/\S+\/reset\?token=[\w-]+/)![0];
    assert.ok(!(await db.passwordResetToken.findFirst({ where: { tokenHash: link.split("token=")[1] } })), "only a hash of the token is stored");
    await g.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
    await g.fill('input[name="next"]', "guided-new-password-1");
    await g.fill('input[name="confirm"]', "guided-new-password-1");
    await Promise.all([g.waitForURL("**/login?reset=1"), g.click('button:has-text("Save my new password")')]);
    await g.waitForSelector("text=Your password is changed.");
    await login(g, guided.email, "guided-new-password-1");
    // the link works only once
    await g.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
    await g.waitForSelector("text=This link has expired");
    await gc.close();
  });

  await check("1g. carry-over: saved I am claims, FORGE statements and behaviors land in the new Who I am", async () => {
    const pw = hashPassword("carry-password-1");
    const mk = async (tag: string, profile: Record<string, string>, identity?: Record<string, string>) => {
      const u = await db.user.create({ data: { email: `e2e-carry-${tag}-${Date.now()}@example.test`, name: `Carry ${tag} (E2E)`, role: "PARTICIPANT", passwordHash: pw, profile: { create: { pathway: "LEADING_OTHERS", onboardedAt: new Date(), ...profile } } } });
      if (identity) await db.identityProfile.create({ data: { userId: u.id, level: "ROLE", ...identity } });
      return u;
    };
    const claimOnly = await mk("a", {}, { becoming: "I am CLAIM-ONLY." });
    const both = await mk("b", { forgeStatement: "I am STATEMENT-B.", destination: "I am LINE-F-B" }, { becoming: "I am OLD-CLAIM-B.", behavior: "BEHAVIOR-B" });
    const linesOnly = await mk("c", { destination: "I am LINE-F-C", lineO: "I am LINE-O-C", forgeStatement: "I am STATEMENT-C." });
    const gc = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const g: Page = await gc.newPage();
    // a claim and no statement: the claim is My statement, and Today shows it
    await login(g, claimOnly.email, "carry-password-1");
    await g.goto(`${BASE}/identity`);
    assert.equal(await g.inputValue('textarea[name="statement"]'), "I am CLAIM-ONLY.");
    await g.goto(`${BASE}/dashboard`);
    await g.waitForSelector("text=I am CLAIM-ONLY.");
    // both, and different: the statement is My statement, the old claim shows once as a note
    await g.context().clearCookies();
    await login(g, both.email, "carry-password-1");
    await g.goto(`${BASE}/identity`);
    assert.equal(await g.inputValue('textarea[name="statement"]'), "I am STATEMENT-B.");
    await g.waitForSelector("text=Earlier I am statement:");
    await g.waitForSelector("text=I am OLD-CLAIM-B.");
    assert.equal(await g.inputValue('textarea[name="destination"]'), "LINE-F-B");
    await g.goto(`${BASE}/dashboard`);
    await g.waitForSelector("text=I am STATEMENT-B.");
    assert.ok(!(await g.locator("main").innerText()).includes("OLD-CLAIM-B"), "Today shows My statement");
    await g.goto(`${BASE}/road`);
    // the behavior is kept in the record; My road now shows the focus instead
    assert.equal((await db.identityProfile.findUniqueOrThrow({ where: { userId: both.id } })).behavior, "BEHAVIOR-B", "a saved behavior is kept");
    // the five and the statement with no identity yet: all there, and nothing is rewritten until the client saves
    await g.context().clearCookies();
    await login(g, linesOnly.email, "carry-password-1");
    await g.goto(`${BASE}/identity`);
    assert.equal(await g.inputValue('textarea[name="lineO"]'), "LINE-O-C");
    assert.equal(await g.inputValue('textarea[name="statement"]'), "I am STATEMENT-C.");
    const b = await db.identityProfile.findUniqueOrThrow({ where: { userId: both.id } });
    assert.equal(b.becoming, "I am OLD-CLAIM-B.", "viewing changes nothing in the database");
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
    await page.waitForSelector("text=Self-rated");
    assert.equal(await page.locator("text=/ 25").count(), 0, "the coach sees no total either");
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
    assert.ok((await box.innerText()).includes("session with Avery Lin"));
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

  await check("9c2. still open says why; saving without a seat says so; the 30 days page leads into week 1 setup", async () => {
    const dc = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const dp: Page = await dc.newPage();
    await login(dp, "dana@demo.bothhands.app");
    await dp.goto(`${BASE}/identity`);
    await dp.waitForSelector("text=Step 1 of 4");
    assert.ok((await dp.locator('nav[aria-label="Your journey"]').innerText()).includes("your seat"), "the journey bar names what is missing");
    await dp.click('button:has-text("Save who I am")');
    await dp.waitForSelector("text=Name the seat you're in (step 1).");
    assert.equal(await dp.locator('[role="dialog"]').count(), 0, "nothing saves until the seat is named");
    // the daily check-in waits for the whole kickoff
    await dp.goto(`${BASE}/dashboard`);
    await dp.waitForSelector("text=Build your system first");
    assert.equal(await dp.locator('button:has-text("Save my daily check-in")').count(), 0, "no check-in before the kickoff is done");
    assert.equal(await dp.locator("text=Check in today").count(), 0);
    await dp.goto(`${BASE}/cycle`);
    await Promise.all([dp.waitForURL(/\/cycle\/setup\?step=1$/), dp.click('a:has-text("Start your week 1 setup")')]);
    await dc.close();
  });

  await check("9d. Who I am sharing is the client's choice; the coach sees nothing until it is on", async () => {
    const dc = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const dp: Page = await dc.newPage();
    await login(dp, "dana@demo.bothhands.app");
    await dp.goto(`${BASE}/identity`);
    await dp.fill('input[name="role"]', "E2E-ROLE");
    await dp.locator("label", { hasText: "Reinvention" }).click();
    await dp.locator("summary", { hasText: "Create a performance identity" }).click();
    await dp.fill('input[name="personaName"]', "E2E-PERSONA");
    await saveThroughReveal(dp, "**/identity?saved=1");
    await page.goto(`${BASE}/coach/${dana.id}`);
    assert.ok(!(await page.content()).includes("E2E-ROLE"), "the role is not visible before the client shares Who I am");
    await dp.goto(`${BASE}/sharing`);
    await Promise.all([dp.waitForLoadState("networkidle"), dp.click(`button[aria-label^="Share: Who's behind the wheel"]`)]);
    await dp.waitForSelector(`button[aria-label^="Stop sharing: Who's behind the wheel"]`);
    await page.goto(`${BASE}/coach/${dana.id}`);
    await page.waitForSelector("text=E2E-ROLE");
    assert.ok(!(await page.content()).includes("E2E-PERSONA"), "persona needs its own tick");
    await dp.goto(`${BASE}/identity`);
    await dp.locator("summary", { hasText: "Help me with this and sharing" }).click();
    await dp.locator('input[name="sharePersona"]').check();
    await dp.locator('input[value="SUPPORTIVE"]').check();
    await Promise.all([dp.waitForLoadState("networkidle"), dp.click('button:has-text("Save these settings")')]);
    let row = await db.identityProfile.findUniqueOrThrow({ where: { userId: dana.id } });
    for (let i = 0; i < 25 && row.tone !== "SUPPORTIVE"; i++) {
      await dp.waitForTimeout(200); // networkidle can resolve before the server action finishes
      row = await db.identityProfile.findUniqueOrThrow({ where: { userId: dana.id } });
    }
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
    // the 30-day plan and its answers are private until the client shares them
    await page.goto(`${BASE}/coach/${dana.id}`);
    await page.waitForSelector("text=Not shared: my 30-day plan");
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

  await check("10d. clients never see Draft marks; the admin sees every draft set in Content review", async () => {
    const dc = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const dp: Page = await dc.newPage();
    await login(dp, "dana@demo.bothhands.app");
    for (const path of ["/dashboard", "/identity", "/assessment", "/road", "/cycle", "/cycle/new", "/network", "/guide", "/pathway/segment/01"]) {
      await dp.goto(`${BASE}${path}`);
      for (const d of await dp.locator("details").all()) await d.evaluate((e) => ((e as HTMLDetailsElement).open = true));
      const text = await dp.locator("main").innerText();
      assert.ok(!/\bdraft\b/i.test(text), `no Draft mark on ${path}`);
    }
    // the Library is the author's teaching guide, and nothing else
    await dp.goto(`${BASE}/library`);
    await dp.waitForSelector("text=The FORGE Framework: Five Rules for the Road");
    const lib = await dp.locator("main").innerText();
    for (const t of ["What FORGE is", "Future Focused", "Emotionally Anchored", "In practice", "How the five work together", "When emotion takes the wheel"]) assert.ok(lib.toLowerCase().includes(t.toLowerCase()), `Library has ${t}`);
    assert.ok(!/Jay's Journey|The Rules of the Road|\bJay\b/.test(lib), "the old Library content is gone, and no one from the book is named");
    assert.ok(lib.includes("Questions for the road") && lib.includes("The Flight You Keep Missing"), "the stories' concepts stand on their own as exercises");
    // each rule's full guide teaches from the guide, with the research
    await dp.goto(`${BASE}/forge/f/guide`);
    await dp.waitForSelector("text=The destination is a person, not a number.");
    await dp.waitForSelector("text=possible selves");
        // Ed's name and Ed's mentor never appear (the author's request)
    for (const path of ["/library", "/network", "/assessment"]) {
      await dp.goto(`${BASE}${path}`);
      for (const d of await dp.locator("details").all()) await d.evaluate((e) => ((e as HTMLDetailsElement).open = true));
      assert.ok(!/\bEd\b|Ed's/.test(await dp.locator("main").innerText()), `no Ed on ${path}`);
    }
    await dc.close();
    await page.goto(`${BASE}/admin/content`);
    await page.waitForSelector("text=Identity examples");
    assert.ok((await page.locator("main .draft").count()) > 5, "draft sets are marked for the admin");
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

  await check("11b. admin turns an account off and back on; nothing is removed", async () => {
    const ac = await browser.newContext();
    const ap: Page = await ac.newPage();
    await login(ap, "admin@demo.bothhands.app", "demo-password-1");
    await ap.goto(`${BASE}/admin/people`);
    const target = "tess@demo.bothhands.app";
    const before = await db.dailyCheckIn.count({ where: { user: { email: target } } });
    const row = ap.locator("div.px-5", { hasText: target });
    await Promise.all([ap.waitForLoadState("networkidle"), row.locator('button:has-text("Turn off")').click()]);
    let t = await db.user.findUniqueOrThrow({ where: { email: target } });
    for (let i = 0; i < 25 && t.status !== "DISABLED"; i++) { await ap.waitForTimeout(200); t = await db.user.findUniqueOrThrow({ where: { email: target } }); }
    assert.equal(t.status, "DISABLED");
    const tc = await browser.newContext();
    const tp: Page = await tc.newPage();
    await tp.goto(`${BASE}/login`);
    await tp.fill('input[name="email"]', target);
    await tp.fill('input[name="password"]', "demo-password-1");
    await tp.click('button:has-text("Sign in")');
    await tp.waitForSelector("text=This account isn't active");
    assert.equal(await db.dailyCheckIn.count({ where: { user: { email: target } } }), before, "nothing they saved is removed");
    await ap.goto(`${BASE}/admin/people`);
    await Promise.all([ap.waitForLoadState("networkidle"), ap.locator("div.px-5", { hasText: target }).locator('button:has-text("Turn back on")').click()]);
    t = await db.user.findUniqueOrThrow({ where: { email: target } });
    for (let i = 0; i < 25 && t.status !== "ACTIVE"; i++) { await ap.waitForTimeout(200); t = await db.user.findUniqueOrThrow({ where: { email: target } }); }
    assert.equal(t.status, "ACTIVE");
    await login(tp, target, "demo-password-1");
    await tc.close();
    await ac.close();
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
