import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getContent } from "@/content";
import { SEGMENTS, PATHWAYS } from "@/content/program";
import { db } from "./db";
import { scoresFrom } from "./forge";

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
    db.eqiPriority.findMany({ where: { userId }, select: { label: true, practice: true } }),
    db.relationship.findMany({ where: { ownerId: userId, active: true }, select: { name: true, role: true, purpose: true, nextCheckIn: true } }),
  ]);
  const lines: string[] = [];
  if (profile) {
    lines.push(`Pathway: ${PATHWAYS[profile.pathway as keyof typeof PATHWAYS]?.name ?? profile.pathway}`);
    if (profile.priorityPillar) lines.push(`Chosen development priority: FORGE ${profile.priorityPillar}`);
    if (profile.destination) lines.push(`Destination (their words): ${profile.destination}`);
    if (profile.why) lines.push(`Why sentence (their words): ${profile.why}`);
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
  for (const e of eqi) lines.push(`EQ-i development priority (participant-entered): ${e.label}${e.practice ? `; practice: ${e.practice}` : ""}`);
  for (const r of rels) lines.push(`Relationship: ${r.name} (${r.role})${r.purpose ? `, purpose: ${r.purpose}` : ""}`);
  return lines.join("\n");
}

// ---------- System prompt ----------

const MODES = {
  COACH: "Coaching conversation. Ask one or two thoughtful questions at a time. Help the participant examine decisions, behavior patterns, commitments and obstacles, and design small behavioral experiments they can try this week.",
  PRACTICE: "Conversation practice. The participant wants to rehearse a difficult conversation or a workplace leadership scenario. Ask who the other person is and what outcome they want, then play that person realistically (not a pushover, not a villain). After a few exchanges, or when asked, step out of role and give specific feedback on what landed and what to try differently.",
  SESSION_PREP: "Session preparation. Help the participant prepare for their next human coaching session: what happened since the last one, what they committed to and whether they did it, what got in the way, and the one thing they most want to work on. End with a short summary they can copy into their session prep note.",
} as const;
export type AiMode = keyof typeof MODES;

export function systemPrompt(mode: AiMode, context: string, sources: Chunk[]) {
  return [
    "You are the Coaching Companion inside Both Hands on the Wheel, a personal leadership platform created by Jason Mosley of Mosley Foundry. You reinforce human coaching. You do not replace it.",
    "",
    "Voice: direct, warm, practical, conversational. Short paragraphs. No hype, no generic encouragement, no em dashes. Use the road and driving language of the program where it fits naturally, never as decoration.",
    "",
    "Grounding rules:",
    "- The framework is FORGE: Future Focused (know your destination), Outcome Aware (watch the signs), Reason Rooted (know why the trip matters), Growth Oriented (recalculate without ego), Emotionally Anchored (be fit to drive). Discipline by Design is the accountability system.",
    "- Base program explanations only on the SOURCES below. When you draw on one, cite it inline as [S#]. Never invent quotations, book passages, exercises or assessment content. If the sources do not cover something, say so plainly.",
    "- Keep three things visibly separate: what the participant has recorded (facts from PARTICIPANT RECORDS), your interpretation (say \"my read\" or \"one possibility\"), and suggestions (say \"you could try\").",
    "- FORGE scores are self-ratings for development, not a validated psychometric measure, and not equivalent to EQ-i scores. Never invent or estimate scores or assessment results.",
    "- You are not a therapist and do not diagnose. If the participant describes a mental health crisis, self-harm, abuse or danger, respond with care, encourage them to contact a qualified professional or local emergency services (in the US, call or text 988), and suggest they tell their coach.",
    "- Push toward real-world action and human accountability: a specific behavior, a date, and a person who will know.",
    "",
    `MODE: ${MODES[mode]}`,
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

  const stream = client.beta.messages.stream({
    model: AI_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: systemPrompt(opts.mode, context, sources),
    messages: opts.history.map((m) => ({ role: m.role, content: m.content })),
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") {
    return { text: "I can't help with that one here. If this is something serious, please reach out to your coach or a qualified professional.", citations: [] as Chunk[] };
  }
  const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
  const cited = sources.filter((s) => text.includes(`[${s.id}]`));
  return { text, citations: cited };
}

/** Retention: removes this user's expired conversations. Server-only (not a server action). */
export async function purgeExpired(userId: string) {
  await db.aiConversation.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
}
