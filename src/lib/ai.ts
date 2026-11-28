import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getContent } from "@/content";
import { getForgeSource } from "@/content/forgeSource";
import { SEGMENTS, PATHWAYS } from "@/content/program";
import { db } from "./db";
import { scoresFrom } from "./forge";
import { effectiveTone, toneBlock } from "./identityTone";
import { FORGE_LINES, LINE_BY_FIELD, type LineField } from "@/content/forgeLines";
import { EXAMPLE_PEOPLE, FOUR_THINGS, IDENTITY_TESTS, peopleFor } from "@/content/identityExamples";
import { KIND_GUIDANCE, KIND_RULE, asRole, withArticle } from "@/content/whoIAm";
import type { IdentityLevel } from "@/content/identity";
import type { PathwayKey } from "@/content/program";
import { EVIDENCE_NOTE_FALLBACK, joinNames, partnerWord, positionWord, reportKeys, type DistanceReport, type ReportPartner, type ReportRule } from "@/lib/distance";
import type { PillarKey } from "@/content/types";

export const AI_MODEL = "claude-opus-5-5";
export const aiAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

// ---------- Retrieval over approved content only ----------

export type Chunk = { id: string; ref: string; text: string };

let chunkCache: { pack: unknown; guide: unknown; chunks: Chunk[] } | null = null;

/** Approved sources: the licensed pack (book + workbook), the entrepreneur worksheet, and the program brief. */
export async function buildChunks(): Promise<Chunk[]> {
  const { pack, entrepreneur } = await getContent();
  const guide = (await getForgeSource())?.guide ?? null;
  if (chunkCache && chunkCache.pack === pack && chunkCache.guide === guide) return chunkCache.chunks;
  const out: Chunk[] = [];
  const add = (ref: string, text: string) => text.trim() && out.push({ id: `S${out.length + 1}`, ref, text });

  // The author's teaching guide, The FORGE Framework: Five Rules for the Road.
  const plain = (md: string) => md.replace(/\*\*|\*/g, "").replace(/^\|.*$/gm, (row) => row.replace(/\|/g, " ").trim());
  if (guide) {
    for (const s of [...guide.intro, ...guide.outro]) add(`${guide.title}: ${s.heading}`, plain(s.md));
    for (const r of Object.values(guide.rules)) if (r) add(`${guide.title}: ${r.heading}`, plain(r.md) + (r.practice ? ` In practice: ${r.practice}` : ""));
  }
  for (const p of pack.pillars) {
    add(`FORGE ${p.key}: ${p.name}`, `${p.name}. ${p.short} ${p.definition} ` + p.anchors.map((a) => `${a.score} ${a.level}: ${a.text}`).join(" "));
    add(`FORGE ${p.key}: if this is your lowest score`, p.lowest.map((g) => `Score ${g.min} to ${g.max}: ${g.text}`).join(" "));
    if (p.rule) add(`Book, Ch. 9 The Rules of the Road, ${p.rule.heading}`, p.rule.paragraphs.join(" "));
  }
  for (const c of pack.chapters) {
    if (c.refuel.length) add(`Book, Ch. ${c.number} ${c.title}, Refuel`, c.refuel.join(" "));
    if (c.reflect.length) add(`Book, Ch. ${c.number} ${c.title}, Reflect`, c.reflect.join(" "));
    if (c.roadTest.length) add(`Book, Ch. ${c.number} ${c.title}, Road Test`, c.roadTest.join(" "));
  }
  const d = pack.discipline;
  if (d.intro.length) add("Book, Ch. 10 Discipline by Design", d.intro.join(" "));
  if (d.whatDisciplineIs.length) add("Book, Ch. 10 Discipline by Design, What Discipline Is", d.whatDisciplineIs.join(" "));
  for (const i of d.inventory) add(`Book, Ch. 10 Discipline by Design, Design Inventory: ${i.label}`, i.text);
  if (d.whosChecking.length) add("Book, Ch. 10 Discipline by Design, So Who's Checking?", d.whosChecking.join(" "));
  if (d.leadingOthers.length) add("Book, Ch. 10 Discipline by Design, Now the Part That Isn't About You", d.leadingOthers.join(" "));
  for (const e of pack.edsLessons) add(`Lessons from the road: ${e.title} (${e.chapter})`, [e.quote, e.setup, ...e.prompts].filter(Boolean).join(" "));
  for (const j of pack.jaysJourney) add(`Questions for the road: ${j.title}`, [j.setup, ...j.prompts].filter(Boolean).join(" "));
  if (pack.thirtyDayPlan.length) add("The 30-day implementation plan", pack.thirtyDayPlan.map((w) => `${w.label} ${w.focus}: ${w.work}`).join(" "));
  for (const s of SEGMENTS) add(`Leading Others program, Segment ${s.key}: ${s.title} (program brief)`, s.summary);
  if (entrepreneur) {
    for (const pt of entrepreneur.patterns) add(`FORGE for entrepreneurs: ${pt.title}`, pt.text.join(" "));
    add(`FORGE Ahead session: building a business`, entrepreneur.owner.fourBuilds.map((b) => `${b.label}: ${b.detail}. ${b.signal}`).join(" ") + " " + entrepreneur.owner.howToBuild + " " + entrepreneur.owner.sellableTest);
  }
  chunkCache = { pack, guide, chunks: out };
  return out;
}

const STOP = new Set("the a an and or of to in is it that this for on with you your i my me be are was what how do does at as by from not but have has if so we they".split(" "));
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));

/** Small BM25-style ranking. Good enough for a few hundred approved chunks; swap for embeddings later. */
export async function retrieve(query: string, k = 6): Promise<Chunk[]> {
  const chunks = await buildChunks();
  const q = tokens(query);
  if (!q.length) return chunks.slice(0, 0);
  const N = chunks.length;
  const docs = chunks.map((c) => tokens(c.ref + " " + c.text));
  const avg = docs.reduce((n, d) => n + d.length, 0) / Math.max(N, 1);
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const scored = docs.map((d, i) => {
    let s = 0;
    for (const t of q) {
      const tf = d.filter((x) => x === t).length;
      if (!tf) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      s += idf * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (d.length / avg))));
    }
    return { i, s };
  });
  return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map((x) => chunks[x.i]);
}

// ---------- Participant context: the participant's own structured records only ----------

/** Never includes the private journal. Labels every item as a recorded fact. */
export async function participantContext(userId: string) {
  const [profile, assessment, goals, cycle, checkIns, sessions, eqi, rels] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.assessment.findFirst({ where: { userId, isSecondOpinion: false }, orderBy: { completedAt: "desc" } }),
    db.developmentGoal.findMany({ where: { userId, status: "ACTIVE" } }),
    db.developmentCycle.findFirst({ where: { userId, status: "ACTIVE" } }),
    db.dailyCheckIn.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 7, select: { date: true, status: true } }),
    db.coachingSession.findMany({ where: { participantId: userId }, orderBy: { scheduledAt: "desc" }, take: 2, select: { scheduledAt: true, agenda: true, commitments: true } }),
    db.eqiPriority.findMany({ where: { userId }, select: { label: true, practice: true, pillar: true } }),
    db.relationship.findMany({ where: { ownerId: userId, active: true }, select: { name: true, role: true, purpose: true, nextCheckIn: true } }),
  ]);
  // My feedback: the client's own summary, only for entries they allowed. Never the file.
  const feedback = await db.feedback.findMany({ where: { userId, allowAi: true }, select: { source: true, title: true, summary: true, pillars: true }, take: 5, orderBy: { createdAt: "desc" } });
  const lines: string[] = [];
  if (profile) {
    lines.push(`Pathway: ${PATHWAYS[profile.pathway as keyof typeof PATHWAYS]?.name ?? profile.pathway}`);
    if (profile.priorityPillar) lines.push(`Chosen development priority: FORGE ${profile.priorityPillar}`);
    for (const l of FORGE_LINES) if (profile[l.field]) lines.push(`FORGE line ${l.pillar}, ${l.label} (their words): ${profile[l.field]}`);
    if (profile.forgeStatement) lines.push(`My statement, their single identity statement in their words: ${profile.forgeStatement}`);
  }
  if (assessment) {
    const s = scoresFrom(assessment);
    lines.push(`Latest Where I am check (their own answers against their own lines, ${assessment.completedAt.toDateString()}): ${(["F", "O", "R", "G", "E"] as const).map((k) => `${k} ${positionWord(s[k])}`).join(", ")}`);
  } else lines.push("No Where I am check completed yet.");
  for (const g of goals) lines.push(`Goal ${g.pillar}${g.isPriority ? " (priority)" : ""}: now "${g.whereNow}" / want "${g.whereWant}"`);
  if (cycle) lines.push(`Active 30-day cycle started ${cycle.startDate.toDateString()} on rule ${cycle.pillar}${cycle.focus ? `, focus: ${cycle.focus}` : ""}`);
  if (checkIns.length) lines.push(`Recent check-ins: ${checkIns.map((c) => `${c.date} ${c.status}`).join(", ")}`);
  for (const s of sessions) if (s.commitments) lines.push(`Coaching commitments from ${s.scheduledAt.toDateString()}: ${s.commitments}`);
  for (const e of eqi) lines.push(`EQ-i development priority (participant's own words, no scores): ${e.label}${e.pillar ? `; linked by the participant to FORGE ${e.pillar}` : ""}${e.practice ? `; practice: ${e.practice}` : ""}`);
  for (const f of feedback) if (f.summary) lines.push(`My feedback, the participant's own summary of a ${f.source === "EQI" ? "EQ-i debrief" : f.source.includes("360") ? "360" : "feedback"} (${f.title}; their words, not the report; do not interpret it as scores)${JSON.parse(f.pillars || "[]").length ? `, which they linked to FORGE ${JSON.parse(f.pillars).join(", ")}` : ""}: ${f.summary.slice(0, 2000)}`);
  for (const r of rels) lines.push(`Relationship: ${r.name} (${r.role})${r.purpose ? `, purpose: ${r.purpose}` : ""}`);
  // Identity shift: sent only if the participant left "use with the AI companion" on.
  // The performance identity is sent only if they also ticked that box.
  const id = await db.identityProfile.findUnique({ where: { userId } });
  if (id && id.aiUse) {
    const kind = { CORE: "core alignment", ROLE: "role transition", REINVENT: "reinvention" }[id.level as "CORE"] ?? id.level;
    if (id.role) lines.push(`The role this is about: ${id.role}`);
    lines.push(`The kind of change (the participant's own choice, not a ranking): ${kind}`);
    if (KIND_GUIDANCE[id.level as IdentityLevel]) lines.push(`How to coach this kind of change: ${KIND_GUIDANCE[id.level as IdentityLevel]}`);
    if (id.becoming && !profile?.forgeStatement) lines.push(`My statement, their single identity statement in their words: ${id.becoming}`);
    if (id.behavior) lines.push(`Behavior that would show it (their words): ${id.behavior}`);
    if (id.level === "REINVENT" && id.aiUsePersona) {
      if (id.personaName) lines.push(`Performance identity they chose, a practice tool: ${id.personaName}`);
      if (id.personaStandards) lines.push(`Their personal standards: ${id.personaStandards}`);
      if (id.personaCue) lines.push(`Their activation cue: ${id.personaCue}`);
    }
  }
  return lines.join("\n");
}

/** The tone block for this participant, or "" when they have no identity profile or turned AI use off. */
export async function participantTone(userId: string) {
  const id = await db.identityProfile.findUnique({ where: { userId }, select: { level: true, tone: true, aiUse: true } });
  return toneBlock(id && id.aiUse ? effectiveTone(id) : null);
}

/** House writing style for everything the AI writes. Set by the author. */
export const HOUSE_STYLE = [
  "WRITING STYLE (follow exactly):",
  "- Write like a plain-spoken person talking to a colleague. Be direct and specific. Short sentences, everyday words. Plain and warm, as if writing for a sharp seventh grader.",
  "- No em dashes. Use straight quotes, not curly quotes.",
  "- Never use these words: steady, drift, rhythm, navigate, resonate, lean into, under pressure, accumulate, compound. Do not use hold or held in an abstract sense (a reason that holds, a commitment that held). Do not use beat as a stage direction.",
  "- Avoid these patterns: stacks of fragments like \"Not X. Not Y.\"; runs of two- or three-word sentences; comma-form contrasts like \"X, not Y\"; template closers like \"That's what...\" or \"That's why...\"; leaning on actually, honestly or genuinely; describing a cost as \"a bill\"; using a day of the week as shorthand for ordinary life; sweeping claims with nobody or everybody; vague callbacks to \"the thing\"; repeating \"name it\"; and calling something \"X with a nicer name\" or \"X dressed up as Y\".",
  "- If a sentence is a little rough but sounds like a real person, keep it. If you are unsure of something, say so instead of guessing.",
].join("\n");

// ---------- System prompt ----------

const MODES = {
  COACH: "Coaching conversation. Ask one or two thoughtful questions at a time. Help the participant examine decisions, behavior patterns, commitments and obstacles, and design small behavioral experiments they can try this week.",
  PRACTICE: "Conversation practice. The participant wants to rehearse a difficult conversation or a workplace leadership scenario. Ask who the other person is and what outcome they want, then play that person realistically (not a pushover, not a villain). After a few exchanges, or when asked, step out of role and give specific feedback on what landed and what to try differently.",
  SESSION_PREP: "Session preparation. Help the participant prepare for their next human coaching session: what happened since the last one, what they committed to and whether they did it, what got in the way, and the one thing they most want to work on. End with a short summary they can copy into their session prep note.",
} as const;
export type AiMode = keyof typeof MODES;

/** Safety net for the style rules: straight quotes and no em dashes, even if the model slips. */
export function plainPunctuation(t: string) {
  return t.replace(/\s*\u2014\s*/g, ", ").replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
}

export function systemPrompt(mode: AiMode, context: string, sources: Chunk[], tone = "") {
  return [
    "You are the Coaching Companion inside Both Hands on the Wheel, a personal leadership platform created by Jason Mosley of Mosley Foundry. You reinforce human coaching. You do not replace it.",
    "",
    HOUSE_STYLE,
    "Use the road and driving language of the program where it fits naturally, never as decoration. No hype and no generic encouragement.",
    "Formatting: plain text, with **bold** only for short labels and simple numbered or dash lists. No headings, tables or other markup.",
    "",
    "Grounding rules:",
    "- The framework is FORGE: Future Focused (know your destination), Outcome Aware (watch the signs), Reason Rooted (know why the trip matters), Growth Oriented (recalculate without ego), Emotionally Anchored (be fit to drive). Discipline by Design is the accountability system.",
    "- Base program explanations only on the SOURCES below. When you draw on one, cite it inline as [S#]. Never invent quotations, book passages, exercises or assessment content. If the sources do not cover something, say so plainly.",
    "- Keep three things visibly separate: what the participant has recorded (facts from PARTICIPANT RECORDS), your interpretation (say \"my read\" or \"one possibility\"), and suggestions (say \"you could try\").",
    "- Where I am answers (Not yet, Starting, Sometimes, Most of the time, Consistently) are the person's own answers against their own lines, for development, not a validated psychometric measure, and not equivalent to EQ-i scores. Never turn them into numbers, and never invent or estimate positions or assessment results.",
    "- You are not a therapist and do not diagnose. If the participant describes a mental health crisis, self-harm, abuse or danger, respond with care, encourage them to contact a qualified professional or local emergency services (in the US, call or text 988), and suggest they tell their coach.",
    "- Push toward real-world action and human accountability: a specific behavior, a date, and a person who will know.",
    "- When you draw on a passage from the book and it would help, you can suggest reading that chapter of Both Hands on the Wheel. At most once in a conversation, and never as a sales pitch. Never mention a workbook or worksheet, or section numbers. The app is standalone.",
    "- FORGE is identity formation, and it comes first. Discipline by Design comes after: it turns the identity into routines, relationships and accountability. Keep them apart. A My statement describes who the person is and how they understand themselves. A habit, task or technique belongs on their road (the the Vehicle Controls page).",
    `- ${KIND_RULE} When the records name a role and a kind of change, coach to them: use the role in your questions and follow the guidance for that kind.`,
    "- Identity statements are claimed in the present tense, in the person's own words: \"I am a leader who operates with integrity.\" Never pressure someone to claim something they do not believe. If they are not there yet, \"I am becoming a courageous leader who speaks up when something matters\" is honest and fine.",
    "",
    `MODE: ${MODES[mode]}`,
    ...(tone ? ["", tone] : []),
    "",
    "PARTICIPANT RECORDS (recorded facts, shared by the participant with you):",
    context || "(none)",
    "",
    "SOURCES (approved program content):",
    sources.length ? sources.map((s) => `[${s.id}] ${s.ref}\n${s.text}`).join("\n\n") : "(no matching sources for this turn)",
  ].join("\n");
}

export async function generateReply(opts: { userId: string; mode: AiMode; history: { role: "user" | "assistant"; content: string }[] }) {
  const client = new Anthropic();
  const lastUser = [...opts.history].reverse().find((m) => m.role === "user")?.content ?? "";
  const sources = await retrieve(lastUser + " " + opts.history.slice(-3).map((m) => m.content).join(" "));
  const context = await participantContext(opts.userId);
  const tone = await participantTone(opts.userId);

  const stream = client.beta.messages.stream({
    model: AI_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: systemPrompt(opts.mode, context, sources, tone),
    messages: opts.history.map((m) => ({ role: m.role, content: m.content })),
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") {
    return { text: "I can't help with that one here. If this is something serious, please reach out to your coach or a qualified professional.", citations: [] as Chunk[] };
  }
  const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
  const cited = sources.filter((s) => text.includes(`[${s.id}]`));
  return { text: plainPunctuation(text), citations: cited };
}

/** Retention: removes this user's expired conversations. Server-only (not a server action). */
export async function purgeExpired(userId: string) {
  await db.aiConversation.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
}

// ---------- "Help me with this" drafts ----------

export type DraftKind = LineField | "forgeStatement";

const LINE_QUERY: Record<LineField, string> = {
  destination: "Future Focused destination picture of the leader you are road test",
  lineO: "Outcome Aware signs pay attention early warning feedback",
  why: "Reason Rooted why sentence generous reason when results are slow",
  lineG: "Growth Oriented distance between here and there recalculate practice skill",
  lineE: "Emotionally Anchored fit to drive respond fear courage confidence",
};

function draftAsk(kind: DraftKind): { query: string; ask: string } {
  if (kind === "forgeStatement") {
    return {
      query: "My statement one paragraph leader destination discipline committing",
      ask: "Draft the participant's statement (My statement): one short paragraph that pulls their five FORGE identity statements together into one description of who they are, in the role their records name. It starts with \"I am\", stays in the present tense, and keeps their own words where it can. It describes the person. It does not list habits, schedules or tasks. If they wrote \"I am becoming\" somewhere, keep that honesty. If some statements are missing, use their identity statement and what else they have recorded.",
    };
  }
  const l = LINE_BY_FIELD[kind];
  const start = l.prefix ? `It must start with the words "${l.prefix}".` : "It is one sentence in the first person.";
  return {
    query: LINE_QUERY[kind],
    ask: `Draft the participant's FORGE identity statement for ${l.pillar}, ${l.label}. The question is: ${l.question} Write one sentence, present tense, first person. ${start} It describes who they are and how they understand themselves. It is never a habit, schedule or task. Fit it to their identity statement if they have one.`,
  };
}

/** Returns a first draft only. Uses the participant's own records; the participant edits and saves it themselves. */
export async function draftField(userId: string, kind: DraftKind) {
  const client = new Anthropic();
  const { query, ask } = draftAsk(kind);
  const sources = await retrieve(query, 4);
  const context = await participantContext(userId);
  const stream = client.beta.messages.stream({
    model: AI_MODEL,
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      "You write first drafts inside Both Hands on the Wheel, a personal leadership app by Jason Mosley. The participant will edit your draft until it is true for them.",
      "Use only what the participant has recorded. Do not invent facts, names, numbers or achievements. If the records are thin, write a short, plain draft and keep it general rather than making things up.",
      HOUSE_STYLE,
      "Return only the draft text, with no introduction, quotation marks or citations.",
      "",
      "PARTICIPANT RECORDS:",
      context || "(none)",
      "",
      "PROGRAM GUIDANCE:",
      sources.map((s) => `${s.ref}: ${s.text}`).join("\n\n") || "(none)",
    ].join("\n"),
    messages: [{ role: "user", content: ask }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") return null;
  return msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim().replace(/\u2014/g, ", ").replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
}

// ---------- Identity coach for the five FORGE statements ----------

export type CoachReply = { kind: "goal" | "habit" | "value" | "identity" | "empty"; note: string; question: string; suggestion: string };

/**
 * Helps the participant find the identity under what they wrote. It names whether the text is a
 * goal, a habit, a value or an identity, asks one question, and offers one statement to edit.
 * Saves nothing.
 */
export async function coachIdentityLine(userId: string, field: LineField, written: string): Promise<CoachReply | null> {
  const l = LINE_BY_FIELD[field];
  const client = new Anthropic();
  const sources = await retrieve(LINE_QUERY[field], 3);
  const context = await participantContext(userId);
  // The role and kind of change shape the question, the examples and the coaching, if the client allows identity use.
  const [idRow, prof] = await Promise.all([
    db.identityProfile.findUnique({ where: { userId }, select: { role: true, level: true, aiUse: true } }),
    db.profile.findUnique({ where: { userId }, select: { pathway: true } }),
  ]);
  const role = idRow?.aiUse ? idRow.role : "";
  const level = idRow?.aiUse ? idRow.level : "";
  const examples = peopleFor((prof?.pathway ?? "PERSONAL") as PathwayKey, role, level).slice(0, 2);
  const stream = client.beta.messages.stream({
    model: AI_MODEL,
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      "You are an identity coach inside Both Hands on the Wheel, a personal leadership app by Jason Mosley.",
      ...(level ? [`They chose ${({ CORE: "core alignment", ROLE: "role transition", REINVENT: "reinvention" } as Record<string, string>)[level]}. ${KIND_GUIDANCE[level as IdentityLevel]}`, KIND_RULE] : []),
      "These five statements describe one identity from five sides. They are not five separate identities.",
      "FORGE is identity formation. It answers who is behind the wheel. Discipline by Design comes later and turns that identity into routines, relationships and accountability.",
      `The participant is writing their ${l.pillar}, ${l.label} identity statement. The question is: ${asRole(l.question, role)} The statement starts with "I am".`,
      "Identity comes first and behavior follows it. People don't sustain a behavior that conflicts with who they believe they are. Behavior already has a home in this app: the Windshield (one or two things, each for 30 days) and the Vehicle Controls (the routines). If the statement names a behavior, the person has claimed a task and those steps have nothing left to do.",
      `Your job is to help them tell apart four things and work at the identity level. A goal is ${FOUR_THINGS.goal}. A habit is ${FOUR_THINGS.habit}. A value is ${FOUR_THINGS.value}. An identity is ${FOUR_THINGS.identity}.`,
      `Apply these four tests to what they wrote and to anything you suggest: ${IDENTITY_TESTS.map((t, i) => `(${i + 1}) ${t}`).join(" ")}`,
      "- Too vague (\"a purposeful leader\") fails test 4: make it specific to the shift they are making. Too narrow (\"the leader who notices when someone goes quiet\") fails tests 1 and 3: that is one of fifty things a leader who puts people before tasks does. Move up to the identity that produces it.",
      `- Examples that pass, from the author: ${examples.map((p) => `(${p.who}) ` + [p.claim, p.lines[field]].join(" ")).join(" ")}`,
      "- If they wrote a goal or a habit: say so kindly, ask one question about what it represents about the person they are becoming, and offer one identity statement built from their words. Mention that the habit itself can go in the Vehicle Controls.",
      "- If they wrote a value: ask what kind of person lives by it, and offer one identity statement.",
      "- If they wrote an identity: say what is strong about it in one sentence. Offer a clearer version only if it would help. Otherwise leave the suggestion empty.",
      "- If they wrote nothing: ask one opening question tied to their I am statement or records, and offer one example statement.",
      "Rules: suggestions start with \"I am\" and stay in the present tense. Never push them to claim something they do not believe. \"I am becoming\" is fine when that is more honest. Use only what they have recorded. Do not invent facts.",
      HOUSE_STYLE,
      'Return only JSON, with no other text: {"kind": "goal" | "habit" | "value" | "identity" | "empty", "note": "one or two sentences", "question": "one question, or empty", "suggestion": "I am ..., or empty"}',
      "",
      "PARTICIPANT RECORDS:",
      context || "(none)",
      "",
      "PROGRAM GUIDANCE:",
      sources.map((x) => `${x.ref}: ${x.text}`).join("\n\n") || "(none)",
    ].join("\n"),
    messages: [{ role: "user", content: written.trim() ? `What I wrote: I am ${written.trim()}` : "I have not written anything yet." }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") return null;
  const raw = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
  return parseCoachReply(raw);
}

/** Reads the coach's JSON. Exported for tests. */
export function parseCoachReply(raw: string): CoachReply | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const kinds = ["goal", "habit", "value", "identity", "empty"];
    return {
      kind: kinds.includes(j.kind) ? j.kind : "identity",
      note: plainPunctuation(String(j.note ?? "")).trim(),
      question: plainPunctuation(String(j.question ?? "")).trim(),
      suggestion: plainPunctuation(String(j.suggestion ?? "")).trim(),
    };
  } catch {
    return null;
  }
}

// ---------- Week 1 setup: help finding words ----------

export type SetupHelpField = "situation" | "feeling" | "oldResponse" | "newResponse" | "gap";

const SETUP_ASK: Record<SetupHelpField, string> = {
  situation: "The question is: when does this pattern happen? Offer 3 to 4 short ways to name the moment plainly (where, who is there, what just happened), built only from what they wrote.",
  feeling:
    "The question is: what do you feel in that moment? Offer 4 to 6 single words or short phrases a person might use for a feeling or a body sensation, as options to choose from. You never state what they feel, never label, interpret or diagnose it, and never use clinical, medical or mental-health terms. Plain everyday words only.",
  oldResponse: "The question is: what do you usually do in that moment? Offer 3 to 4 short, plain, non-judging ways to describe the usual response, built only from what they wrote.",
  newResponse: "The question is: what does the person you're becoming do instead? Offer 3 to 4 short responses that fit their five I am lines: one small thing they could do in that moment. Each starts with a verb.",
  gap: "The question is: what makes the new response hard, and what do you need to learn or let go of? Offer 3 to 4 short, honest ways to put it, built only from what they wrote.",
};

/** Options for the client to choose from and edit. Saves nothing, and never decides for the client. */
export async function setupHelp(userId: string, field: SetupHelpField, written: string, earlier: Record<string, string>): Promise<string[] | null> {
  const client = new Anthropic();
  const context = await participantContext(userId);
  const msg = await client.beta.messages.create({
    model: AI_MODEL,
    max_tokens: 1200,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      "You help a participant in Both Hands on the Wheel, a personal leadership app by Jason Mosley, find their own words for a pattern they want to interrupt over 30 days. You offer options. The participant chooses and edits.",
      "Use only what the participant has written and recorded. Do not invent facts, names or events.",
      "Never label, interpret or diagnose a feeling or a person. Never use clinical, medical or mental-health terms.",
      HOUSE_STYLE,
      'Return only a JSON array of strings, like ["first option", "second option"]. No other text.',
      "",
      "PARTICIPANT RECORDS:",
      context || "(none)",
      "",
      "THEIR ANSWERS SO FAR:",
      Object.entries(earlier).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n") || "(none)",
    ].join("\n"),
    messages: [{ role: "user", content: `${SETUP_ASK[field]}\n\nWhat they wrote for this question: ${written || "(nothing yet)"}` }],
  });
  if (msg.stop_reason === "refusal") return null;
  const raw = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("").trim();
  try {
    const arr = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").map((x: string) => plainPunctuation(x).slice(0, 200)).slice(0, 6) : null;
  } catch {
    return null;
  }
}

// ---------- Set the Tone: language with power, with myself and with others ----------

/** What the coach needs for both modes: the client's five lines, statement and seat, and the book's guidance. */
async function toneContext(userId: string) {
  const [prof, idRow, sources] = await Promise.all([
    db.profile.findUnique({ where: { userId }, select: { destination: true, lineO: true, why: true, lineG: true, lineE: true, forgeStatement: true } }),
    db.identityProfile.findUnique({ where: { userId }, select: { role: true, becoming: true, aiUse: true } }),
    retrieve("self-talk tone setting language emotional temperature center console conversation", 4),
  ]);
  return {
    lines: FORGE_LINES.map((l) => `${l.pillar} (${l.label}): ${(prof?.[l.field] ?? "").trim() || "(not written yet)"}`),
    statement: prof?.forgeStatement || idRow?.becoming || "",
    role: idRow?.aiUse ? idRow.role : "",
    sources,
  };
}

const TONE_PRINCIPLE = "Why this matters: words are not only an expression of thought. They are instructions to the brain about what to believe, and they set the temperature for everyone who hears them. Say \"I can't\" and the mind goes looking for proof that you can't, finds it, and the body follows. Say \"I don't know\" and the mind stops searching. Blame someone and they defend instead of fix. Treat every word as an instruction with real consequences. Nothing here is to be played with.";

async function askTone(system: string[], user: string) {
  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: AI_MODEL,
    max_tokens: 2500,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: system.join("\n"),
    messages: [{ role: "user", content: user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") return null;
  return msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
}

function toneFooter(ctx: Awaited<ReturnType<typeof toneContext>>) {
  return [
    HOUSE_STYLE,
    "",
    "THEIR FIVE FORGE LINES:",
    ...ctx.lines,
    ctx.statement ? `THEIR STATEMENT: ${ctx.statement}` : "",
    "",
    "PROGRAM GUIDANCE:",
    ctx.sources.map((x) => `${x.ref}: ${x.text}`).join("\n\n") || "(none)",
  ];
}

export type ToneReading = {
  summary: string;
  lines: { rule: "F" | "O" | "R" | "G" | "E"; fit: "supports" | "pulls"; note: string }[];
  doors: { said: string; truer: string; why: string }[];
  chain: { thought: string; words: string; feeling: string; action: string; stepIn: string };
  keep: { kind: "CLAIM" | "CONFIRM" | "CONDEMN"; text: string } | null;
  /** Coaching yourself by your own first name: one line. */
  byName: string;
  /** One of the book's own self-talk questions, word for word, chosen for this moment. "" when none fits. */
  question: string;
};

/**
 * With myself: reads what the client told themselves against their own five FORGE lines. Every limited-language
 * line gets a new way to say it, in the first person, and why it matters. Saves nothing.
 */
export async function readSelfTalkAI(userId: string, said: string, closedDoors: string[], questions: string[] = [], firstName = ""): Promise<ToneReading | null> {
  const ctx = await toneContext(userId);
  const raw = await askTone([
    "You are the Set the Tone coach inside Both Hands on the Wheel, a personal leadership app by Jason Mosley.",
    "The book's idea: you set the tone before the world does. Self-talk shapes behavior. The chain runs from how you think about something, to how you talk about it, to how you feel about it, to what you do.",
    TONE_PRINCIPLE,
    "The participant wrote down, in their own words, what they just told themselves. This is their own voice, usually in the first person. Do not cast it as an enemy, an imposter or a second person. Your job is to catch limited language and replace it with language that has power, measured against the identity they claimed in their own five FORGE lines. Those lines are the standard. Do not invent a different identity for them.",
    ...(ctx.role ? [`They are working on this as ${withArticle(ctx.role)}.`] : []),
    "Be firm and on their side. Go after limited language directly. Do not comfort, soften or agree with it. Never say things like \"that's a fair place to start\", \"it's okay to struggle\" or \"that's understandable\". Even when the words sound mild (\"this is tough, I'm struggling\"), find the limit underneath, what it says they can't do or won't be, and answer it. No hedging words like maybe or might.",
    "Return:",
    "- summary: two or three plain sentences with force. Name what these words are instructing their brain to believe, what it will cost if they keep saying it, and point to who they said they are.",
    "- doors: for each limited-language phrase (the app found these: " + (closedDoors.length ? closedDoors.map((d) => `"${d}"`).join(", ") : "none") + ", and add every other one you see, including quiet ones like \"I'm struggling\" or \"this is too much\"), give said (their exact words, short), truer (the new way to say it, first person, short enough to say out loud, in this style: \"I can't\" becomes \"I'll try\"; \"I don't know\" becomes \"Not sure right now, but I'll find out\"; never a made-up claim they don't believe), and why (one or two firm sentences: what the old words instruct their brain to believe, the proof their mind will go find, and what their body will do with it).",
    "- lines: only the one or two FORGE lines this clearly touches. fit is \"pulls\" when the words work against that line, \"supports\" when part of what they wrote sounds like the person in that line. note is one sentence that sets a few of their words against a few words of the line. Empty if nothing clearly connects.",
    "- chain: thought, words, feeling, action, each a few words drawn from what they wrote (leave one empty rather than guess), and stepIn: the one place in the chain to cut it off, as one short sentence.",
    "- keep: one line worth keeping, in their voice, that passes one of the three Cs: CLAIM (a victory, milestone or outcome they are going after), CONFIRM (a belief about their own attributes or abilities) or CONDEMN (the negativity or roadblock that would stop them). null if nothing honest fits.",
    firstName
      ? `- byName: one or two sentences in which they coach themselves by their own first name, ${firstName}, the way a good coach would talk to them: \"${firstName}, you've handled harder rooms than this. Start with the first five minutes.\" Grounded in what they wrote and in their FORGE lines. No hype.`
      : "- byName: \"\".",
    ...(questions.length ? [`- question: the one question from the book, below, that this person most needs to sit with right now. Copy it exactly, word for word. Use "" if none fits. THE BOOK'S QUESTIONS: ${questions.map((q) => `"${q}"`).join(" | ")}`] : ["- question: \"\"."]),
    "Rules: this is coaching, not therapy. Do not diagnose. If the words suggest danger to themselves or others, set summary to a short note encouraging them to talk to someone they trust or a professional, and leave everything else empty.",
    'Return only JSON, with no other text: {"summary": "", "doors": [{"said": "", "truer": "", "why": ""}], "lines": [{"rule": "E", "fit": "pulls", "note": ""}], "chain": {"thought": "", "words": "", "feeling": "", "action": "", "stepIn": ""}, "keep": {"kind": "CONFIRM", "text": ""}, "byName": "", "question": ""}',
    ...toneFooter(ctx),
  ], `What I told myself: ${said.trim()}`);
  if (!raw) return null;
  const r = parseToneReading(raw);
  // Only the book's own words: a question that isn't one of them, word for word, is dropped.
  if (r && !questions.includes(r.question)) r.question = "";
  return r;
}

/** Reads the self-talk coach's JSON, keeping only well-formed parts. Exported for tests. */
export function parseToneReading(raw: string): ToneReading | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const str = (v: unknown, max = 600) => plainPunctuation(String(v ?? "")).trim().slice(0, max);
    const RULES = ["F", "O", "R", "G", "E"];
    const KINDS = ["CLAIM", "CONFIRM", "CONDEMN"];
    const c = j.chain ?? {};
    return {
      summary: str(j.summary),
      lines: (Array.isArray(j.lines) ? j.lines : [])
        .filter((x: { rule?: string; fit?: string }) => RULES.includes(String(x?.rule)) && ["supports", "pulls"].includes(String(x?.fit)))
        .slice(0, 2)
        .map((x: { rule: string; fit: string; note?: string }) => ({ rule: x.rule as ToneReading["lines"][number]["rule"], fit: x.fit as "supports" | "pulls", note: str(x.note, 300) })),
      doors: (Array.isArray(j.doors) ? j.doors : [])
        .filter((x: { said?: string; truer?: string }) => str(x?.said) && str(x?.truer))
        .slice(0, 6)
        .map((x: { said: string; truer: string; why?: string }) => ({ said: str(x.said, 200), truer: str(x.truer, 300), why: str(x.why, 400) })),
      chain: { thought: str(c.thought, 200), words: str(c.words, 200), feeling: str(c.feeling, 200), action: str(c.action, 200), stepIn: str(c.stepIn, 300) },
      keep: j.keep && KINDS.includes(String(j.keep.kind)) && str(j.keep.text) ? { kind: j.keep.kind, text: str(j.keep.text, 300) } : null,
      byName: str(j.byName, 400),
      question: String(j.question ?? "").trim(),
    };
  } catch {
    return null;
  }
}

export type ConversationReading = {
  /** The tone to set: what the room needs from them. */
  tone: string;
  /** The first sentence, written out. */
  opener: string;
  /** What they were tempted to say, kept in meaning, rewritten with confidence and safety. */
  rewrite: string;
  /** What the original words would do to the other person, and what the new words do instead. */
  why: string;
  /** Two or three questions so the other person talks. */
  questions: string[];
  /** One line to bring the temperature back down if it goes sideways. */
  sideways: string;
  /** How their own FORGE line shows up in this conversation. "" when none clearly does. */
  identity: string;
};

/**
 * With someone else, "How do I say it?": the client is about to have a hard conversation, or wants to lead or
 * encourage someone. Returns the tone to set, an opener, a rewrite of what they were tempted to say, why it
 * matters, questions to ask and a way back if it goes sideways. Saves nothing.
 */
export async function readConversationAI(userId: string, who: string, situation: string, tempted: string): Promise<ConversationReading | null> {
  const ctx = await toneContext(userId);
  const raw = await askTone([
    "You are the Set the Tone coach inside Both Hands on the Wheel, a personal leadership app by Jason Mosley.",
    "The book's idea: you set the tone before the world does. A leader's words set the ceiling before the room has a chance to find the floor. When the language changes, the temperature in the room changes.",
    TONE_PRINCIPLE,
    "The participant is about to talk with someone: a hard conversation, feedback, or a moment to lead or encourage. Help them say it with confidence and power and with psychological safety for the other person: direct about the issue, respectful of the person, curious about what happened. Keep what they mean. Drop blame, sarcasm, labels about the person and questions that are really accusations (\"what's wrong with you?\").",
    ...(ctx.role ? [`They are doing this as ${withArticle(ctx.role)}.`] : []),
    "Return:",
    "- tone: one or two sentences on the temperature to set and what the other person needs to feel to engage (safe enough to be honest, clear on what matters).",
    "- opener: the first sentence or two they say, written out, ready to use.",
    "- rewrite: what they were tempted to say, rewritten. Same point, said with confidence and without blame. If they gave nothing, write what they could say.",
    "- why: two or three firm sentences. What their original words would do to the other person (defend, shut down, comply without committing) and what the new words do instead.",
    "- questions: two or three open questions that get the other person talking. Short.",
    "- sideways: one line to say if it starts going badly, to bring the temperature back down without dropping the point.",
    "- identity: one sentence on how one of their own FORGE lines shows up in this conversation, quoting a few words of the line. \"\" if none clearly fits.",
    "Rules: this is coaching for everyday leadership and relationships. Do not give legal or HR advice; if the situation involves harassment, safety or anything legal, say in tone that they should involve HR or the right professional. No hedging words like maybe or might.",
    'Return only JSON, with no other text: {"tone": "", "opener": "", "rewrite": "", "why": "", "questions": [""], "sideways": "", "identity": ""}',
    ...toneFooter(ctx),
  ], [`Who: ${who.trim() || "(not given)"}`, `What's going on: ${situation.trim() || "(not given)"}`, `What I'm tempted to say: ${tempted.trim() || "(not given)"}`].join("\n"));
  return raw ? parseConversationReading(raw) : null;
}

/** Reads the conversation coach's JSON. Exported for tests. */
export function parseConversationReading(raw: string): ConversationReading | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const str = (v: unknown, max = 600) => plainPunctuation(String(v ?? "")).trim().slice(0, max);
    const r: ConversationReading = {
      tone: str(j.tone),
      opener: str(j.opener, 400),
      rewrite: str(j.rewrite),
      why: str(j.why),
      questions: (Array.isArray(j.questions) ? j.questions : []).map((q: unknown) => str(q, 200)).filter(Boolean).slice(0, 3),
      sideways: str(j.sideways, 300),
      identity: str(j.identity, 300),
    };
    return r.opener || r.rewrite ? r : null;
  } catch {
    return null;
  }
}

export type CoachBriefContent = {
  /** What happened since the last session, from what the client shares. */
  since: string[];
  /** Patterns worth raising. */
  patterns: string[];
  /** Three questions to ask. */
  questions: string[];
  /** One program exercise to consider, by its stable reference. */
  exercise: { ref: string; title: string; why: string } | null;
  /** One thing to be careful with in the room. "" when nothing stands out. */
  careful: string;
};

/**
 * Session prep for a coach: a short brief built only from what the client shares with that coach (the context is
 * assembled from the coach view, which already applies the client's sharing choices). A draft for the coach to check,
 * never a verdict on the client. Saves nothing.
 */
export async function coachBriefAI(context: string, query: string, menu: { ref: string; title: string }[]): Promise<CoachBriefContent | null> {
  const sources = await retrieve(query, 4);
  const raw = await askTone([
    "You help a coach prepare for a one-on-one coaching session inside Both Hands on the Wheel, a personal leadership app by Jason Mosley built on his book.",
    "The program: FORGE is the client's identity (five rules: Future Focused, Observant, Resilient, Growth Oriented, Emotionally Anchored), and Discipline by Design is the system that builds it into their week (routines, planning time, people). Clients work on one or two focuses, each for 30 days, with a daily check-in and a weekly look back called the Mirrors.",
    "You see only what this client chose to share with their coach. Some areas may be missing: never guess at them, never say what they might contain, and never treat a missing area as a problem.",
    "Write for the coach, in plain words, about the client by first name. Ground every point in something in the shared data. Describe what the data shows, not what the client is like: no diagnoses, no labels, no claims about personality, and nothing presented as certain that the data does not show.",
    "Where I am answers are the person's own answers. Do not turn them into numbers, compare them to EQ-i scores, or treat them as a validated measure.",
    "Return:",
    "- since: two to four short points on what happened since the last session (or recently, if there was none): practice, the Mirrors, commitments from last time, exercises.",
    "- patterns: one to three patterns worth raising, each one sentence, each tied to what the data shows.",
    "- questions: exactly three open questions the coach could ask, in the coach's voice, short. At least one should connect their practice back to who they said they are.",
    `- exercise: one exercise from this list that fits right now, by its ref, with why in one sentence; or null if none clearly fits. THE LIST: ${menu.map((m) => `${m.ref} = ${m.title}`).join("; ")}`,
    "- careful: one sentence on something to handle with care in the room, or \"\" if nothing stands out.",
    "Rules: this is coaching, not therapy. If the shared data suggests risk to the client or others, set careful to say the coach should check in on wellbeing first and point to professional support, and keep the rest brief.",
    'Return only JSON, with no other text: {"since": [""], "patterns": [""], "questions": ["", "", ""], "exercise": {"ref": "", "why": ""}, "careful": ""}',
    HOUSE_STYLE,
    "",
    "PROGRAM GUIDANCE:",
    sources.map((x) => `${x.ref}: ${x.text}`).join("\n\n") || "(none)",
  ], `WHAT THIS CLIENT SHARES WITH THEIR COACH:\n${context}`);
  if (!raw) return null;
  const b = parseCoachBrief(raw);
  if (b?.exercise) {
    const m = menu.find((x) => x.ref === b.exercise!.ref);
    b.exercise = m ? { ...b.exercise, title: m.title } : null;
  }
  return b;
}

/** Reads the session prep JSON, keeping only well-formed parts. Exported for tests. */
export function parseCoachBrief(raw: string): CoachBriefContent | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const str = (v: unknown, max = 500) => plainPunctuation(String(v ?? "")).trim().slice(0, max);
    const list = (v: unknown, n: number) => (Array.isArray(v) ? v : []).map((x) => str(x, 400)).filter(Boolean).slice(0, n);
    const ex = j.exercise && typeof j.exercise === "object" && str(j.exercise.ref) ? { ref: str(j.exercise.ref, 60), title: "", why: str(j.exercise.why, 300) } : null;
    const b = { since: list(j.since, 4), patterns: list(j.patterns, 3), questions: list(j.questions, 3), exercise: ex, careful: str(j.careful, 400) };
    return b.since.length || b.patterns.length || b.questions.length ? b : null;
  } catch {
    return null;
  }
}

export type ProposedAction =
  | { type: "assign_exercise"; client: string; exerciseRef: string; title: string; instructions: string; dueOn: string }
  | { type: "schedule_session"; client: string; when: string; agenda: string };

/**
 * The coach assistant: turns a coach's plain-words instruction into proposed actions on their own clients.
 * Sees only the coach's client names and the program's exercise titles, never client data. Proposes; never acts.
 */
export async function planCoachActionsAI(instruction: string, clients: string[], menu: { ref: string; title: string }[], today: string): Promise<{ actions: ProposedAction[]; unclear: string[] } | null> {
  const raw = await askTone([
    "You are the coach assistant inside Both Hands on the Wheel, a coaching app by Jason Mosley. A coach tells you, in plain words, what to do for their clients. Turn it into a list of actions for the coach to approve. You never act yourself.",
    "You can propose two kinds of action:",
    "- assign_exercise: give one client an exercise. Use a program exercise by its ref when the coach names one or clearly means one (match by title, chapter or topic). Otherwise use exerciseRef \"custom\" with a short title and the instructions in the coach's own words, tidied but not padded. dueOn is a date as YYYY-MM-DD, or \"\" if none was given.",
    "- schedule_session: book a coaching session with one client. when is YYYY-MM-DDTHH:mm in 24-hour time. agenda in a few words, or \"\".",
    `Today is ${today}. Work out dates like "Friday" or "next Tuesday" from today. If no time is given for a session, leave that action out and say so in unclear.`,
    "One action per client per thing: \"assign Bob and Paul X\" is two actions. Use the client's name exactly as it appears in the list. If a name matches no one in the list, or matches more than one, leave it out and say so in unclear.",
    "unclear: short plain notes on anything you could not turn into an action, or a guess the coach should check. [] if none.",
    `THE COACH'S CLIENTS: ${clients.join("; ") || "(none)"}`,
    `PROGRAM EXERCISES: ${menu.map((m) => `${m.ref} = ${m.title}`).join("; ")}`,
    'Return only JSON, with no other text: {"actions": [{"type": "assign_exercise", "client": "", "exerciseRef": "", "title": "", "instructions": "", "dueOn": ""}, {"type": "schedule_session", "client": "", "when": "", "agenda": ""}], "unclear": [""]}',
    HOUSE_STYLE,
  ], instruction.trim());
  return raw ? parseCoachPlan(raw) : null;
}

/** Reads the coach assistant's JSON, keeping only well-formed actions. Exported for tests. */
export function parseCoachPlan(raw: string): { actions: ProposedAction[]; unclear: string[] } | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const str = (v: unknown, max = 300) => plainPunctuation(String(v ?? "")).trim().slice(0, max);
    const actions: ProposedAction[] = [];
    for (const a of Array.isArray(j.actions) ? j.actions.slice(0, 30) : []) {
      if (a?.type === "assign_exercise" && str(a.client) && (str(a.exerciseRef) || str(a.title))) {
        const due = str(a.dueOn, 10);
        actions.push({ type: "assign_exercise", client: str(a.client, 120), exerciseRef: str(a.exerciseRef, 60) || "custom", title: str(a.title, 200), instructions: str(a.instructions, 6000), dueOn: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : "" });
      } else if (a?.type === "schedule_session" && str(a.client) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str(a.when, 16))) {
        actions.push({ type: "schedule_session", client: str(a.client, 120), when: str(a.when, 16), agenda: str(a.agenda, 3000) });
      }
    }
    const unclear = (Array.isArray(j.unclear) ? j.unclear : []).map((x: unknown) => str(x)).filter(Boolean).slice(0, 10);
    return { actions, unclear };
  } catch {
    return null;
  }
}

export type WrapUp = {
  /** The coach's private notes, tidied from what they wrote. */
  notes: string;
  /** What the client agreed to, as the client will read it. */
  commitments: string;
  /** A short follow-up message from the coach to the client. */
  followUp: string;
  exercise: { ref: string; title: string; why: string } | null;
};

/**
 * After-session wrap-up: the coach's rough notes become tidy private notes, the commitments the client will see,
 * a follow-up message and the next exercise. The context is what the client shares with the coach. A draft only.
 */
export async function wrapUpAI(roughNotes: string, firstName: string, context: string, menu: { ref: string; title: string }[]): Promise<WrapUp | null> {
  const raw = await askTone([
    "You help a coach wrap up a one-on-one coaching session inside Both Hands on the Wheel, a personal leadership app by Jason Mosley built on his book (FORGE for identity, Discipline by Design for the system that builds it into the week).",
    "The coach wrote rough notes right after the session. Turn them into a draft the coach will check and edit. Use only what is in the notes and the shared context. Never invent what was said or agreed.",
    `The client's first name is ${firstName}.`,
    "Return:",
    "- notes: the coach's private notes, tidied. Keep every fact from the rough notes. Short lines, no padding. Only the coach sees these.",
    `- commitments: what ${firstName} agreed to do, as ${firstName} will read it on their own screen. One per line, starting with a verb, specific, with a when if the notes give one. Only what the notes show was agreed. "" if nothing was agreed.`,
    `- followUp: a short message from the coach to ${firstName}, three to five sentences, warm and direct, in the coach's voice: thank them, name the one thing that mattered most, restate the commitments plainly, and say when you'll next talk if the notes say. No sign-off name.`,
    `- exercise: one program exercise that fits what was agreed, by its ref, with why in one sentence; or null. THE LIST: ${menu.map((m) => `${m.ref} = ${m.title}`).join("; ")}`,
    'Return only JSON, with no other text: {"notes": "", "commitments": "", "followUp": "", "exercise": {"ref": "", "why": ""}}',
    HOUSE_STYLE,
  ], `ROUGH NOTES FROM THE SESSION:\n${roughNotes.trim()}\n\nWHAT ${firstName.toUpperCase()} SHARES WITH THE COACH:\n${context || "(nothing)"}`);
  if (!raw) return null;
  const w = parseWrapUp(raw);
  if (w?.exercise) {
    const m = menu.find((x) => x.ref === w.exercise!.ref);
    w.exercise = m ? { ...w.exercise, title: m.title } : null;
  }
  return w;
}

/** Reads the wrap-up JSON. Exported for tests. */
export function parseWrapUp(raw: string): WrapUp | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const str = (v: unknown, max: number) => plainPunctuation(String(v ?? "")).trim().slice(0, max);
    const w = { notes: str(j.notes, 8000), commitments: str(j.commitments, 4000), followUp: str(j.followUp, 2000), exercise: j.exercise && str(j.exercise.ref, 60) ? { ref: str(j.exercise.ref, 60), title: "", why: str(j.exercise.why, 300) } : null };
    return w.notes || w.commitments || w.followUp ? w : null;
  } catch {
    return null;
  }
}

export type CohortPrep = {
  /** What the group is working on, from the totals. */
  working: string[];
  /** Where the group looks stuck, from the totals. */
  stuck: string[];
  /** A plan for the session, in timed parts. */
  plan: { minutes: number; part: string; detail: string }[];
  /** Three questions for the room. */
  questions: string[];
};

/**
 * Cohort session prep for a facilitator, from group totals only (see cohortPulse). Never about one person.
 * A draft plan for the facilitator to adapt.
 */
export async function cohortPrepAI(pulse: string, minutes: number): Promise<CohortPrep | null> {
  const sources = await retrieve(pulse.slice(0, 400), 4);
  const raw = await askTone([
    "You help a facilitator prepare a group session of the Leading Others program inside Both Hands on the Wheel, by Jason Mosley. The program uses FORGE (Future Focused, Observant, Resilient, Growth Oriented, Emotionally Anchored) for identity and Discipline by Design for the system that builds it into the week.",
    "You get the session's segment content and, for groups big enough, group totals. You never see anything about one person, and you must not write as if you do: talk about the group and its numbers only. Where I am answers are people's own answers, not a validated measure; never turn them into numbers or compare them to EQ-i.",
    `Plan a session of about ${minutes} minutes.`,
    "Return:",
    "- working: one to three short points on what the group is working on, from the totals. [] if there are no totals.",
    "- stuck: one to three short points on where the group may be stuck, each tied to a number in the totals, said as something to explore rather than a finding. [] if there are no totals.",
    "- plan: four to six timed parts that add up to the session length: an opening check-in, the segment's teaching, practice in pairs or small groups, a debrief, and commitments for the week. Each part has minutes, a short name and one or two sentences of detail.",
    "- questions: exactly three questions for the room, open and short.",
    'Return only JSON, with no other text: {"working": [""], "stuck": [""], "plan": [{"minutes": 10, "part": "", "detail": ""}], "questions": ["", "", ""]}',
    HOUSE_STYLE,
    "",
    "PROGRAM GUIDANCE:",
    sources.map((x) => `${x.ref}: ${x.text}`).join("\n\n") || "(none)",
  ], `THE SESSION AND THE GROUP:\n${pulse}`);
  return raw ? parseCohortPrep(raw) : null;
}

/** Reads the cohort prep JSON. Exported for tests. */
export function parseCohortPrep(raw: string): CohortPrep | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const str = (v: unknown, max = 400) => plainPunctuation(String(v ?? "")).trim().slice(0, max);
    const list = (v: unknown, n: number) => (Array.isArray(v) ? v : []).map((x) => str(x)).filter(Boolean).slice(0, n);
    const plan = (Array.isArray(j.plan) ? j.plan : []).slice(0, 8)
      .map((x: { minutes?: unknown; part?: unknown; detail?: unknown }) => ({ minutes: Math.max(1, Math.min(240, Math.round(Number(x?.minutes) || 0))), part: str(x?.part, 80), detail: str(x?.detail, 400) }))
      .filter((x: { part: string }) => x.part);
    const c = { working: list(j.working, 3), stuck: list(j.stuck, 3), plan, questions: list(j.questions, 3) };
    return c.plan.length || c.questions.length ? c : null;
  } catch {
    return null;
  }
}

// ---------- The distance check ("Where I am"): the author's prompts, word for word ----------

export type DistanceScenario = { scenario: string; options: { type: "autopilot" | "white_knuckle" | "avoidance" | "future_self"; text: string }[] };
const SCENARIO_TYPES = ["autopilot", "white_knuckle", "avoidance", "future_self"] as const;

export async function distanceScenarioAI(i: { seat: string; ruleName: string; ruleLetter: string; line: string; oldResponse: string; feeling: string; hard: string; target: string }): Promise<DistanceScenario | null> {
  const system = `You write one short pressure scenario for a coaching app called Both Hands on the Wheel. The person is measuring how close they are to their future self.

Inputs:
- seat: ${i.seat}
- rule: ${i.ruleName} (${i.ruleLetter})
- their line for this rule: "${i.line}"
- what they usually do (may be empty): "${i.oldResponse}"
- what they feel in that moment (may be empty): "${i.feeling}"
- what makes it hard (may be empty): "${i.hard}"
- rule target: ${i.target}

Write:
1. A scenario of 2 or 3 sentences, in second person, specific to their seat and their real life. Include a concrete detail (a time, a person, a stake) and a deadline or pressure. It must test this rule's target.
2. Four options, one of each type:
   - autopilot: their old response. If "what they usually do" is given and fits, use it in plain words.
   - white_knuckle: the right-looking move while the old fear or habit still drives.
   - avoidance: stalling, ignoring, or letting it pass.
   - future_self: how the person in their line would handle it. Describe how they decide, not a perfect outcome.

Rules:
- Each option is one sentence, under 20 words, written as an action ("Say yes that afternoon...").
- All four options must sound reasonable. No option should be obviously wrong or obviously right.
- Use plain, direct language. No em dashes. Never use the word "rhythm."
- Do not repeat their identity line word for word in any option.
- Do not mention FORGE, rules, or option types.

Return JSON only:
{"scenario": "...", "options": [{"type": "autopilot", "text": "..."}, {"type": "white_knuckle", "text": "..."}, {"type": "avoidance", "text": "..."}, {"type": "future_self", "text": "..."}]}`;
  // Kept apart from the author's prompt above, which stays as written: the AI only knows what the person told it.
  const guard = `Use only what the inputs say about this person. Don't invent facts about their life: no children, spouse, family, ages, sports, school, hobbies or weekend plans unless the seat or their own words mention them. If the seat is a parent, don't assume how old their children are. When the inputs don't say, set the scenario in their working day or in a moment anyone could face.`;
  const raw = await askTone([system, guard], "Write the scenario now.");
  const made = raw ? parseDistanceScenario(raw, i.line) : null;
  // If it brought in a life detail they never mentioned, the written situation for their seat is used instead.
  return made && !inventsLife(made, [i.seat, i.line, i.oldResponse, i.feeling, i.hard].join(" ")) ? made : null;
}

/** Family and home details the AI must not assume. "Partner" is left out: in a coaching app it's usually a business or accountability partner. */
const LIFE_WORDS = /\b(kids?|child|children|son|sons|daughters?|toddlers?|bab(y|ies)|teen(ager)?s?|spouse|husband|wife|family|soccer|baseball|football|softball|basketball|hockey|recital|homework|school|bedtime|pta|carpool)\b/gi;

/** True when the situation names a life detail (children, spouse, a kid's game) that isn't anywhere in what the person told us. */
export function inventsLife(s: DistanceScenario, told: string) {
  const t = told.toLowerCase();
  const found = [s.scenario, ...s.options.map((o) => o.text)].join(" ").match(LIFE_WORDS) ?? [];
  const root = (w: string) => w.toLowerCase().replace(/(ren|s|ies)$/, "").replace(/^kid$/, "kid").replace(/^teenager$/, "teen");
  const family = /\b(parent|mom|dad|mother|father|kids?|child|children|son|daughter|family|spouse|husband|wife|grand)/.test(t);
  return found.some((w) => {
    const r = root(w);
    if (t.includes(r)) return false;
    // A parent's seat allows their children and family, but nothing about ages or activities.
    if (family && /^(kid|child|son|daughter|family)/.test(r)) return false;
    return true;
  });
}

/** Reads the scenario JSON and checks it: one option of each type, each short, no banned words, no copy of their line. */
export function parseDistanceScenario(raw: string, line = ""): DistanceScenario | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const clean = (v: unknown) => plainPunctuation(String(v ?? "")).replace(/\s+/g, " ").trim();
    const scenario = clean(j.scenario).slice(0, 600);
    const options = (Array.isArray(j.options) ? j.options : []).map((o: { type?: unknown; text?: unknown }) => ({ type: String(o?.type ?? ""), text: clean(o?.text).slice(0, 200) }));
    const types = new Set(options.map((o: { type: string }) => o.type));
    if (!scenario || options.length !== 4 || SCENARIO_TYPES.some((t) => !types.has(t))) return null;
    const all = [scenario, ...options.map((o: { text: string }) => o.text)].join(" ");
    if (/\brhythm/i.test(all) || /\bFORGE\b/.test(all) || /white.?knuckle|autopilot|future.?self/i.test(options.map((o: { text: string }) => o.text).join(" "))) return null;
    if (options.some((o: { text: string }) => !o.text || o.text.split(/\s+/).length > 24)) return null;
    if (line.trim().length > 20 && options.some((o: { text: string }) => o.text.toLowerCase().includes(line.trim().toLowerCase()))) return null;
    return { scenario, options: options as DistanceScenario["options"] };
  } catch {
    return null;
  }
}

export async function evidenceCheckAI(i: { line: string; question: string; answer: string; position: number }): Promise<{ evidence: "concrete" | "vague" | "missing"; note: string } | null> {
  const system = `You check whether a coaching app user gave a concrete example.

Inputs:
- their line: "${i.line}"
- the question they answered: "${i.question}"
- their answer: "${i.answer}"
- the road position they chose (1 to 5): ${i.position}

Decide:
- "concrete": a specific moment with at least one real detail (when, who, or what happened)
- "vague": general statements ("I usually stay calm," "I try my best")
- "missing": empty, off topic, or "I don't know"

If the result is vague or missing AND position is 4 or 5, write a short note in plain, warm, direct language, under 30 words, that points out they placed themselves close but couldn't name a moment, and invites them to add one or move their position. Don't lecture. No em dashes.

Otherwise, note is empty.

Return JSON only:
{"evidence": "concrete" | "vague" | "missing", "note": "..."}`;
  const raw = await askTone([system], "Check the answer now.");
  return raw ? parseEvidenceCheck(raw, i.position) : null;
}

/** Reads the evidence JSON. A note only comes back for a close position (4 or 5) with thin proof. */
export function parseEvidenceCheck(raw: string, position: number): { evidence: "concrete" | "vague" | "missing"; note: string } | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const evidence = String(j.evidence ?? "");
    if (!["concrete", "vague", "missing"].includes(evidence)) return null;
    const thin = evidence !== "concrete" && position >= 4;
    const note = thin ? plainPunctuation(String(j.note ?? "")).trim().slice(0, 300) || EVIDENCE_NOTE_FALLBACK : "";
    return { evidence: evidence as "concrete" | "vague" | "missing", note };
  } catch {
    return null;
  }
}

/** The distance report: four short sections, written from the per-rule results and the rules the app worked out. */
export async function distanceReportAI(rules: ReportRule[], partners: ReportPartner[] = []): Promise<Omit<DistanceReport, "keys" | "source"> | null> {
  const keys = reportKeys(rules);
  const p = partners.length ? joinNames(partners.map((x) => x.name)) : "your partner";
  const system = `You write a short distance report for a coaching app. The person measured how close they are to their own future self across five rules: Future Focused, Outcome Aware, Reason Rooted, Growth Oriented, Emotionally Anchored.

Inputs, per rule: identity line, road position (as words, not numbers), evidence result, pressure type chosen, partner rating (may be missing). Also: which rule the app computed as closest, widest gap, disagreement, and blind spot.

Write four short sections, 1 or 2 sentences each:
1. "Closest to the future you": name the rule and quote a few words of their line.
2. "Widest gap": name the rule and what showed it (position, pressure answer, or proof).
3. "Where your answers disagree": only if a disagreement exists; otherwise leave empty.
4. "What ${p} sees": only if partner data exists; otherwise "Waiting on ${p}."

Rules:
- Use driving language lightly and only where it fits.
- Never show numbers, scores, percentages, or option type names.
- Honest, not harsh. Don't praise effort or add encouragement filler.
- Plain words. No em dashes. Never use the word "rhythm."

Return JSON only:
{"closest": "...", "widest_gap": "...", "disagreement": "...", "partner": "..."}`;
  const name = (k: PillarKey | null) => rules.find((r) => r.pillar === k)?.name ?? "none";
  const user = [
    ...rules.map((r) => `${r.name}: line "${r.line}"; road position: ${positionWord(r.position)}; evidence: ${r.evidence || "missing"}; pressure type: ${r.pressure || "none"}; partner rating: ${r.partnerViews?.length ? r.partnerViews.map((v) => `${v.name}: ${partnerWord(v.rating)}`).join(", ") : "missing"}`),
    "",
    `Closest: ${name(keys.closest)}. Widest gap: ${name(keys.widest)}. Disagreement: ${name(keys.disagree)}. Blind spot: ${name(keys.blind)}.`,
    partners.length ? `Partners asked: ${partners.map((x) => `${x.name} (${x.answered ? "answered" : "not answered yet"})`).join(", ")}.` : "No partner was asked.",
  ].join("\n");
  const raw = await askTone([system], user);
  return raw ? parseDistanceReport(raw, partners.length > 0) : null;
}

/** Reads the report JSON and checks it: the first two sections are there, and nothing shows a number or an option type. */
export function parseDistanceReport(raw: string, hasPartner = false): Omit<DistanceReport, "keys" | "source"> | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const clean = (v: unknown) => plainPunctuation(String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, 500);
    const out = { closest: clean(j.closest), widest_gap: clean(j.widest_gap), disagreement: clean(j.disagreement), partner: hasPartner ? clean(j.partner) : "" };
    if (!out.closest || !out.widest_gap) return null;
    const all = Object.values(out).join(" ");
    if (/\d|%/.test(all) || /\brhythm/i.test(all) || /white.?knuckle|autopilot|future_self|\bavoidance\b/i.test(all)) return null;
    return out;
  } catch {
    return null;
  }
}

/** The text message to the accountability partner. The link goes in where the prompt puts {link}. */
export async function partnerMessageAI(i: { name: string; partnerName: string; lines: string[]; link: string }): Promise<string | null> {
  const system = `You write a short text message from a coaching app to someone's accountability partner.

Inputs:
- person's first name: ${i.name}
- partner's first name: ${i.partnerName}
- the five identity lines: ${i.lines.map((l) => `"${l}"`).join("; ")}

Write a message under 60 words that:
- says ${i.name} is working on who they're becoming and asked ${i.partnerName} for an honest view
- says it takes about two minutes
- ends with the link placeholder {link}

Plain and friendly. No em dashes. Don't include the lines in the text message itself; they appear on the linked page.

Return JSON only: {"message": "..."}`;
  const raw = await askTone([system], "Write the message now.");
  return raw ? parsePartnerMessage(raw, i.lines, i.link) : null;
}

/** Checks the message: short, ends with the link, and none of the lines copied into it. */
export function parsePartnerMessage(raw: string, lines: string[], link: string): string | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const t = plainPunctuation(String(JSON.parse(m[0]).message ?? "")).replace(/\s+/g, " ").trim();
    if (!t.endsWith("{link}") || t.split(/\s+/).length > 60 || /\brhythm/i.test(t)) return null;
    if (lines.some((l) => l.trim().length > 20 && t.toLowerCase().includes(l.trim().toLowerCase()))) return null;
    return t.replace("{link}", link);
  } catch {
    return null;
  }
}
