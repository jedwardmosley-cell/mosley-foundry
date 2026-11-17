"use server";
import Anthropic from "@anthropic-ai/sdk";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parse, bool } from "@/lib/validation";
import { aiAvailable, readSelfTalkAI, readConversationAI, generateReply } from "@/lib/ai";
import { addDays } from "@/lib/dates";
import { findClosedDoors, soundsLikeDistress, bookQuestions } from "@/lib/tone";
import { getContent } from "@/content";

const participant = () => requireUser("PARTICIPANT");

/** Help me with this is available for this client. */
async function aiOn(userId: string) {
  const profile = await db.profile.findUnique({ where: { userId }, select: { aiEnabled: true } });
  return aiAvailable() && profile?.aiEnabled !== false;
}

/**
 * Set the Tone, with myself: save what the client told themselves, find limited language by rule and,
 * when Help me with this is on, read it against their FORGE identity. Distress skips coaching.
 */
export async function readSelfTalk(fd: FormData) {
  const u = await participant();
  const { said } = parse(z.object({ said: z.string().trim().min(3, "Write a few words first.").max(3000) }), fd);
  const doors = findClosedDoors(said);
  const entry = await db.toneEntry.create({ data: { userId: u.id, mode: "SELF", text: said, closedDoor: JSON.stringify(doors.map((d) => d.label)) } });
  revalidatePath("/tone");
  if (soundsLikeDistress(said)) redirect(`/tone?entry=${entry.id}&care=1`);
  if (!(await aiOn(u.id))) redirect(`/tone?entry=${entry.id}&ai=off`);
  let note = "";
  try {
    const { pack } = await getContent();
    const firstName = u.name.split(" (")[0].trim().split(/\s+/)[0] ?? "";
    const reading = await readSelfTalkAI(u.id, said, doors.map((d) => d.said), bookQuestions(pack.chapters), firstName);
    if (reading) await db.toneEntry.update({ where: { id: entry.id }, data: { reading: JSON.stringify(reading) } });
    else note = "none";
  } catch (err) {
    if (err instanceof Anthropic.APIError) note = "busy";
    else throw err;
  }
  redirect(`/tone?entry=${entry.id}${note ? `&ai=${note}` : ""}`);
}

/**
 * Set the Tone, with someone else ("How do I say it?"): before a hard conversation, or to lead or encourage
 * someone. Saves the situation and, when Help me with this is on, the coach's reading.
 */
export async function prepConversation(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({
    who: z.string().trim().max(200).default(""),
    situation: z.string().trim().min(3, "Say what's going on.").max(2000),
    tempted: z.string().trim().max(2000).default(""),
  }), fd);
  const doors = findClosedDoors(d.tempted);
  const entry = await db.toneEntry.create({ data: { userId: u.id, mode: "OTHERS", who: d.who, situation: d.situation, text: d.tempted, closedDoor: JSON.stringify(doors.map((x) => x.label)) } });
  revalidatePath("/tone");
  if (soundsLikeDistress(`${d.situation} ${d.tempted}`)) redirect(`/tone?entry=${entry.id}&care=1`);
  if (!(await aiOn(u.id))) redirect(`/tone?entry=${entry.id}&ai=off`);
  let note = "";
  try {
    const reading = await readConversationAI(u.id, d.who, d.situation, d.tempted);
    if (reading) await db.toneEntry.update({ where: { id: entry.id }, data: { reading: JSON.stringify(reading) } });
    else note = "none";
  } catch (err) {
    if (err instanceof Anthropic.APIError) note = "busy";
    else throw err;
  }
  redirect(`/tone?entry=${entry.id}${note ? `&ai=${note}` : ""}`);
}

/**
 * "Practice it": opens a practice conversation in Help me with this, already told who it's with, what's going on
 * and the opener, so the rehearsal starts at once. The other person is played by the AI.
 */
export async function practiceConversation(fd: FormData) {
  const u = await participant();
  const { id } = parse(z.object({ id: z.string() }), fd);
  const e = await db.toneEntry.findFirst({ where: { id, userId: u.id, mode: "OTHERS" } });
  if (!e) redirect("/tone");
  const profile = await db.profile.findUnique({ where: { userId: u.id }, select: { aiEnabled: true, aiRetentionDays: true } });
  if (profile && !profile.aiEnabled) redirect("/settings");
  const r = e.reading ? (JSON.parse(e.reading) as { opener?: string }) : {};
  const seed = [
    `I want to practice a conversation with ${e.who || "someone"}.`,
    `What's going on: ${e.situation}`,
    r.opener ? `I plan to open with: "${r.opener}"` : "",
    "Play them realistically. I'll start.",
  ].filter(Boolean).join("\n");
  const c = await db.aiConversation.create({ data: { userId: u.id, mode: "PRACTICE", title: `Practice: ${(e.who || e.situation).slice(0, 50)}`, expiresAt: addDays(new Date(), profile?.aiRetentionDays ?? 90) } });
  await db.aiMessage.create({ data: { conversationId: c.id, role: "user", content: seed } });
  if (aiAvailable()) {
    try {
      const reply = await generateReply({ userId: u.id, mode: "PRACTICE", history: [{ role: "user", content: seed }] });
      await db.aiMessage.create({ data: { conversationId: c.id, role: "assistant", content: reply.text, citations: JSON.stringify(reply.citations.map((x) => ({ id: x.id, ref: x.ref }))) } });
    } catch (err) {
      if (!(err instanceof Anthropic.APIError)) throw err;
    }
  }
  redirect(`/companion/${c.id}`);
}

/** Keep a line in the client's own catalog, sorted by the three Cs. */
export async function keepToneLine(fd: FormData) {
  const u = await participant();
  const d = parse(z.object({ line: z.string().trim().min(2).max(300), kind: z.enum(["CLAIM", "CONFIRM", "CONDEMN"]), entry: z.string().optional() }), fd);
  await db.toneLine.create({ data: { userId: u.id, text: d.line, kind: d.kind } });
  revalidatePath("/tone");
  redirect(`/tone?kept=1${d.entry ? `&entry=${d.entry}` : ""}#keep`);
}

export async function removeToneLine(fd: FormData) {
  const u = await participant();
  const { id } = parse(z.object({ id: z.string() }), fd);
  await db.toneLine.deleteMany({ where: { id, userId: u.id } });
  revalidatePath("/tone");
}

export async function deleteToneEntry(fd: FormData) {
  const u = await participant();
  const { id } = parse(z.object({ id: z.string() }), fd);
  await db.toneEntry.deleteMany({ where: { id, userId: u.id } });
  revalidatePath("/tone");
  redirect("/tone");
}

/** Whether Set the Tone also looks for patterns in check-in notes and weekly look backs. Off unless the client turns it on. */
export async function setToneReadsWriting(fd: FormData) {
  const u = await participant();
  const { on } = parse(z.object({ on: bool }), fd);
  await db.profile.update({ where: { userId: u.id }, data: { toneReadsWriting: on } });
  revalidatePath("/tone");
  revalidatePath("/reflect");
}

