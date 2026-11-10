/**
 * DEMO DATA. Every person, organization and entry below is fictional.
 * Run: npm run db:seed   (idempotent: removes previous demo records first)
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { defaultSchedule } from "../src/content/program";

const db = new PrismaClient();
const PASSWORD = "demo-password-1";
const day = (offset: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return d; };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monday = (offsetWeeks = 0) => { const d = day(0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offsetWeeks * 7); return ymd(d); };

async function main() {
  await db.user.deleteMany({ where: { isDemo: true } });
  await db.organization.deleteMany({ where: { isDemo: true } });

  const hash = hashPassword(PASSWORD);
  const org = await db.organization.create({ data: { name: "Harbor & Pine Co. (Demo)", isDemo: true } });
  const mk = (email: string, name: string, role: string, pathway = "LEADING_OTHERS", orgId: string | null = org.id) =>
    db.user.create({ data: { email, name, role, passwordHash: hash, isDemo: true, orgId, profile: role === "PARTICIPANT" ? { create: { pathway, onboardedAt: day(-20) } } : undefined } });

  const admin = await mk("admin@demo.bothhands.app", "Jordan Park (Demo Admin)", "ADMIN");
  const coach = await mk("coach@demo.bothhands.app", "Avery Lin (Demo Coach)", "COACH");
  const dana = await mk("dana@demo.bothhands.app", "Dana Reyes (Demo)", "PARTICIPANT");
  const marcus = await mk("marcus@demo.bothhands.app", "Marcus Hill (Demo)", "PARTICIPANT", "ENTREPRENEURIAL", null);
  const others = await Promise.all([
    mk("priya@demo.bothhands.app", "Priya Natarajan (Demo)", "PARTICIPANT"),
    mk("owen@demo.bothhands.app", "Owen Brooks (Demo)", "PARTICIPANT"),
    mk("lena@demo.bothhands.app", "Lena Ortiz (Demo)", "PARTICIPANT"),
    mk("sam@demo.bothhands.app", "Sam Whitaker (Demo)", "PARTICIPANT"),
    mk("tess@demo.bothhands.app", "Tess Morgan (Demo)", "PARTICIPANT"),
  ]);
  void admin;

  // ---- Cohort: three-week format, finished three weeks ago, now in reinforcement ----
  const start = day(-35);
  start.setHours(0, 0, 0, 0);
  const cohort = await db.cohort.create({
    data: {
      orgId: org.id, name: "Spring Manager Cohort (Demo)", deliveryFormat: "THREE_WEEK", startDate: start, reinforceDays: 30, isDemo: true,
      sessions: { create: defaultSchedule(start, "THREE_WEEK").map((s) => ({ ...s, facilitatorId: coach.id, location: "Training Room B" })) },
    },
    include: { sessions: true },
  });
  const participants = [dana, ...others];
  await db.cohortMember.createMany({ data: [{ cohortId: cohort.id, userId: coach.id, role: "FACILITATOR" }, ...participants.map((p) => ({ cohortId: cohort.id, userId: p.id, role: "PARTICIPANT" }))] });
  for (const s of cohort.sessions) {
    await db.attendance.createMany({
      data: participants.map((p, i) => ({ sessionId: s.id, userId: p.id, status: i === 3 && s.segmentKey === "05" ? "ABSENT" : "PRESENT" })),
    });
  }
  for (const p of [dana, others[0], others[1]]) await db.coachAssignment.create({ data: { coachId: coach.id, participantId: p.id } });
  await db.coachAssignment.create({ data: { coachId: coach.id, participantId: marcus.id } });

  // ---- Dana: Leading Others, working Emotionally Anchored ----
  await db.profile.update({
    where: { userId: dana.id },
    data: {
      priorityPillar: "E",
      destination: "A manager my team brings bad news to early, because they know I will stay steady and help them fix it. Calm in the budget meeting, curious in the one-on-one, and home for dinner.",
      why: "The people on my team deserve a leader who makes hard days easier, not harder.",
      forgeStatement: "I am becoming a leader who settles the room instead of heating it. I am driving toward a team that raises problems early. I am building one practice: when a decision of mine gets challenged, I pause, ask one question, and answer second. I read this every Monday and my accountability partner checks on it every other Friday.",
    },
  });
  await db.assessment.create({ data: { userId: dana.id, instrument: "FORGE_PERSONAL", f: 4, o: 3, r: 4, g: 3, e: 2, revisedE: 2, revisedO: 3, completedAt: day(-20), reflections: JSON.stringify({ E: "When a peer questions my numbers in front of my director, I get sharp and defend instead of listen." }) } });
  await db.developmentGoal.createMany({ data: [
    { userId: dana.id, pillar: "E", isPriority: true, whereNow: "Sharp and defensive when challenged in meetings", whereWant: "Curious first, answer second", oneMove: "Pause and ask one question before I respond to a challenge" },
    { userId: dana.id, pillar: "O", whereNow: "I wait for monthly numbers", whereWant: "Read early signals weekly", oneMove: "Ask each report for one early signal in our one-on-one" },
    { userId: dana.id, pillar: "E", segmentKey: "03", whereNow: "I avoid the conversation with Reggie about deadlines", whereWant: "Address it early as a coaching conversation", oneMove: "Book 30 minutes with him by Thursday" },
  ] });
  await db.commitment.createMany({ data: [
    { userId: dana.id, area: "ROUTINES", title: "Fifteen minutes before the house wakes up: read and write", cadence: "DAILY", when: "6:15 am" },
    { userId: dana.id, area: "WEEKLY", title: "Plan the week", cadence: "WEEKLY", when: "Sunday 7 pm" },
    { userId: dana.id, area: "WEEKLY", title: "Saturday look back: did I do what I said?", cadence: "WEEKLY", when: "Saturday 8 am" },
    { userId: dana.id, area: "LEARNING", title: "Work through one leadership book a month", cadence: "MONTHLY" },
    { userId: dana.id, area: "LEADERSHIP", title: "Team commitments board: owner, date, follow-up", cadence: "WEEKLY", when: "Tuesday stand-up" },
    { userId: dana.id, area: "REVIEW", title: "Quarterly destination check", cadence: "QUARTERLY" },
  ] });
  const r1 = await db.relationship.create({ data: { ownerId: dana.id, name: "Keisha Grant", role: "ACCOUNTABILITY_PARTNER", purpose: "Checks my pause practice and my FORGE Statement", cadenceDays: 14, nextCheckIn: day(4) } });
  await db.relationship.create({ data: { ownerId: dana.id, name: "Ruth Alvarez", role: "MENTOR", purpose: "Former VP. Tells me the truth about the road ahead", cadenceDays: 30, nextCheckIn: day(-3) } });
  await db.relationship.create({ data: { ownerId: dana.id, name: "Reggie Shaw", role: "DIRECT_REPORT", purpose: "Developing him into a team lead", cadenceDays: 7, nextCheckIn: day(2) } });
  await db.relationship.create({ data: { ownerId: dana.id, name: "Thursday leaders circle", role: "GROUP", purpose: "Peer group of new managers", cadenceDays: 7, nextCheckIn: day(1) } });
  await db.relationshipCheckIn.create({ data: { relationshipId: r1.id, occurredOn: day(-10), happened: true, lessons: "I paused twice this week and the meeting went differently both times.", agreedActions: "Try the pause with my director, not just peers." } });

  const cycle = await db.developmentCycle.create({ data: { userId: dana.id, template: "NIRS_30", pillar: "E", focus: "Pausing before I answer when a decision gets challenged", startDate: (() => { const d = day(-9); d.setHours(0, 0, 0, 0); return d; })(), weekNotes: JSON.stringify({ 1: "It shows up most with peers in front of my director. My jaw tightens first." }), weekStatus: JSON.stringify({ 1: "DONE" }) } });
  const pattern = ["DONE", "DONE", "PARTIAL", "DONE", "NOT_YET", "DONE", "PARTIAL", "DONE", "DONE"];
  for (let i = 0; i < pattern.length; i++) {
    await db.dailyCheckIn.create({ data: {
      userId: dana.id, cycleId: cycle.id, date: ymd(day(-9 + i)), status: pattern[i],
      note: i === 4 ? "Back-to-back meetings, no room to practice" : i === 7 ? "Asked Marco what he was seeing before defending the forecast" : "",
      reflection: i === 7 ? "The question bought me five seconds and changed the temperature." : i === 2 ? "Caught it halfway through. Private note: I was exhausted." : "",
      shared: i === 7,
    } });
  }
  await db.weeklyReflection.create({ data: { userId: dana.id, weekOf: monday(-1), didIt: "PARTIAL", built: "The pause, five times out of seven", avoided: "The conversation with Reggie", nextWeek: "Book Reggie. Try the pause with my director.", shared: true } });
  await db.journalEntry.create({ data: { userId: dana.id, title: "Private", body: "PRIVATE DEMO JOURNAL: this text must never appear to a coach or admin." } });
  await db.eqiPriority.create({ data: { userId: dana.id, label: "Impulse control when challenged in meetings", practice: "One breath and one question before responding", participantApproved: true } });
  for (const scope of ["GOALS", "PRACTICE", "REFLECTIONS", "NETWORK", "EQI"]) await db.shareGrant.create({ data: { ownerId: dana.id, granteeId: coach.id, scope } });
  await db.coachingSession.create({ data: { coachId: coach.id, participantId: dana.id, scheduledAt: day(3), agenda: "Week 2: Interrupt It. Where does the pause break down?", participantPrep: "The pause works with peers. Not yet with my director." } });
  await db.coachingSession.create({ data: { coachId: coach.id, participantId: dana.id, scheduledAt: day(-11), agenda: "Debrief FORGE profile", commitments: "Start a 30-day cycle on E. Name an accountability partner.", coachNotes: "Coach-private note (demo)." } });
  await db.assignedExercise.create({ data: { coachId: coach.id, participantId: dana.id, exerciseRef: "custom", title: "The Trigger and the Practice", instructions: "Name the trigger precisely. Name one practice you can actually reach in the moment.", dueOn: day(5) } });

  // ---- Marcus: entrepreneur, high R, low F and O. Shares nothing with the coach. ----
  await db.assessment.create({ data: { userId: marcus.id, instrument: "FORGE_ENTREPRENEUR", f: 2, o: 2, r: 5, g: 4, e: 3, completedAt: day(-6) } });
  await db.profile.update({ where: { userId: marcus.id }, data: { priorityPillar: "F", why: "So the neighborhood kids have a shop that teaches them a trade." } });
  await db.journalEntry.create({ data: { userId: marcus.id, body: "PRIVATE DEMO JOURNAL (Marcus)." } });

  // ---- Light activity for the rest of the cohort so aggregate reporting has data ----
  for (const [i, p] of others.entries()) {
    await db.assessment.create({ data: { userId: p.id, instrument: "FORGE_PERSONAL", f: 3, o: 3 + (i % 2), r: 4, g: 3, e: 3, completedAt: day(-18) } });
    if (i < 3) for (let k = 0; k < 4 + i; k++) await db.dailyCheckIn.create({ data: { userId: p.id, date: ymd(day(-k - 1)), status: k % 3 === 0 ? "PARTIAL" : "DONE" } });
  }
  await db.shareGrant.create({ data: { ownerId: others[0].id, granteeId: coach.id, scope: "PRACTICE" } });

  console.log(`Seeded demo data. Password for all demo accounts: ${PASSWORD}`);
}

main().finally(() => db.$disconnect());
