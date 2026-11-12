import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getContent } from "@/content";
import { SEGMENTS, PATHWAYS } from "@/content/program";
import { db } from "./db";
import { scoresFrom } from "./forge";
import { effectiveTone, toneBlock } from "./identityTone";
import { FORGE_LINES, LINE_BY_FIELD, type LineField } from "@/content/forgeLines";

export const AI_MODEL = "claude-opus-5-5";
export const aiAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

// ---------- Retrieval over approved content only ----------

export type Chunk = { id: string; ref: string; text: string };

let chunkCache: { pack: unknown; chunks: Chunk[] } | null = null;

/** Approved sources: the licensed pack (book + workbook), the entrepreneur worksheet, and the program brief. */
export async function buildChunks(): Promise<Chunk[]> {
  const { pack, entrepreneur } = await getContent();
  if (chunkCache && chunkCache.pack === pack) return chunkCache.chunks;
  const out: Chunk[] = [];
  const add = (ref: string, text: string) => text.trim() && out.push({ id: `S${out.length + 1}`, ref, text });

  for (const p of pack.pillars) {
    add(`FORGE ${p.key}: ${p.name} (Workbook, Section One)`, `${p.name}. ${p.short} ${p.definition} ` + p.anchors.map((a) => `${a.score} ${a.level}: ${a.text}`).join(" "));
    add(`FORGE ${p.key}: if this is your lowest score (Workbook, Section Two)`, p.lowest.map((g) => `Score ${g.min} to ${g.max}: ${g.text}`).join(" "));
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
  for (const e of pack.edsLessons) add(`Workbook, Section Four, Ed's Lessons: ${e.title} (${e.chapter})`, [e.quote, e.setup, ...e.prompts].filter(Boolean).join(" "));
  for (const j of pack.jaysJourney) add(`Workbook, Section Five, Jay's Journey: ${j.title}`, [j.setup, ...j.prompts].filter(Boolean).join(" "));
  for (const p of pack.profiles) add(`Workbook, Section Three, FORGE in the Wild: ${p.name}`, [p.subtitle, p.designedDiscipline, p.lesson].filter(Boolean).join(" "));
  if (pack.thirtyDayPlan.length) add("Workbook, Section Seven, 30-Day Implementation Plan", pack.thirtyDayPlan.map((w) => `${w.label} ${w.focus}: ${w.work}`).join(" "));
  for (const s of SEGMENTS) add(`Leading Others program, Segment ${s.key}: ${s.title} (program brief)`, s.summary);
  if (entrepreneur) {
    for (const pt of entrepreneur.patterns) add(`FORGE Worksheet for Entrepreneurs, ${pt.title}`, pt.text.join(" "));
    add(`FORGE Ahead session: building a business`, entrepreneur.owner.fourBuilds.map((b) => `${b.label}: ${b.detail}. ${b.signal}`).join(" ") + " " + entrepreneur.owner.howToBuild + " " + entrepreneur.owner.sellableTest);
  }
  chunkCache = { pack, chunks: out };
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
  const lines: string[] = [];
  if (profile) {
    lines.push(`Pathway: ${PATHWAYS[profile.pathway as keyof typeof PATHWAYS]?.name ?? profile.pathway}`);
    if (profile.priorityPillar) lines.push(`Chosen development priority: FORGE ${profile.priorityPillar}`);
    for (const l of FORGE_LINES) if (profile[l.field]) lines.push(`FORGE line ${l.pillar}, ${l.label} (their words): ${profile[l.field]}`);
    if (profile.forgeStatement) lines.push(`FORGE Statement (their words): ${profile.forgeStatement}`);
  }
  if (assessment) {
    const s = scoresFrom(assessment);
    lines.push(`Latest FORGE self-assessment (self-rated, ${assessment.completedAt.toDateString()}): F ${s.F}, O ${s.O}, R ${s.R}, G ${s.G}, E ${s.E}`);
  } else lines.push("No FORGE self-assessment completed yet.");
  for (const g of goals) lines.push(`Goal ${g.pillar}${g.isPriority ? " (priority)" : ""}: now "${g.whereNow}" / want "${g.whereWant}" / one move "${g.oneMove}"`);
  if (cycle) lines.push(`Active 30-day cycle started ${cycle.startDate.toDateString()} on pillar ${cycle.pillar}${cycle.focus ? `, focus: ${cycle.focus}` : ""}`);
  if (checkIns.length) lines.push(`Recent check-ins: ${checkIns.map((c) => `${c.date} ${c.status}`).join(", ")}`);
  for (const s of sessions) if (s.commitments) lines.push(`Coaching commitments from ${s.scheduledAt.toDateString()}: ${s.commitments}`);
  for (const e of eqi) lines.push(`EQ-i development priority (participant's own words, no scores): ${e.label}${e.pillar ? `; linked by the participant to FORGE ${e.pillar}` : ""}${e.practice ? `; practice: ${e.practice}` : ""}`);
  for (const r of rels) lines.push(`Relationship: ${r.name} (${r.role})${r.purpose ? `, purpose: ${r.purpose}` : ""}`);
  // Identity Shift: sent only if the participant left "use with the AI Companion" on.
  // The performance identity is sent only if they also ticked that box.
  const id = await db.identityProfile.findUnique({ where: { userId } });
  if (id && id.aiUse) {
    const level = { CORE: "Level 1, Core Alignment", ROLE: "Level 2, Role Transition", REINVENT: "Level 3, Identity Reinvention" }[id.level as "CORE"] ?? id.level;
    lines.push(`Identity Shift (participant's own choice of scope, not a ranking): ${level}`);
    if (id.becoming) lines.push(`Identity statement, a present-tense claim in their words: ${id.becoming}`);
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
    "- FORGE scores are self-ratings for development, not a validated psychometric measure, and not equivalent to EQ-i scores. Never invent or estimate scores or assessment results.",
    "- You are not a therapist and do not diagnose. If the participant describes a mental health crisis, self-harm, abuse or danger, respond with care, encourage them to contact a qualified professional or local emergency services (in the US, call or text 988), and suggest they tell their coach.",
    "- Push toward real-world action and human accountability: a specific behavior, a date, and a person who will know.",
    "- Identity statements are claimed in the present tense: \"I am a leader who operates with integrity.\" When you quote, draft or suggest one, write it as an I am statement. Never rewrite it as \"I'm becoming\" or \"I want to be.\"",
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

// ---------- "Help me write this" drafts ----------

export type DraftKind = LineField | "forgeStatement";

const LINE_QUERY: Record<LineField, string> = {
  destination: "Future Focused destination picture of the leader you are Road Test",
  lineO: "Outcome Aware signs pay attention early warning feedback",
  why: "Reason Rooted why sentence generous reason when results are slow",
  lineG: "Growth Oriented distance between here and there recalculate practice skill",
  lineE: "Emotionally Anchored fit to drive respond fear courage confidence",
};

function draftAsk(kind: DraftKind): { query: string; ask: string } {
  if (kind === "forgeStatement") {
    return {
      query: "FORGE Statement one paragraph leader destination discipline committing",
      ask: "Draft the participant's FORGE Statement: one short paragraph that pulls their five FORGE lines together. It starts with \"I am\", stays in the present tense, and keeps their own words where it can. If some lines are missing, use their identity statement and what else they have recorded. Never use \"becoming\" or \"will\".",
    };
  }
  const l = LINE_BY_FIELD[kind];
  const start = l.prefix ? `It must start with the words "${l.prefix}".` : "It is one sentence in the first person.";
  return {
    query: LINE_QUERY[kind],
    ask: `Draft the participant's FORGE line for ${l.pillar}, "${l.label}". The question is: ${l.question} Write one sentence, present tense, first person. ${start} It describes who they are or what they do now, never "becoming" or "will". Fit it to their identity statement if they have one.`,
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
