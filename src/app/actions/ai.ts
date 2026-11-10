"use server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parse } from "@/lib/validation";
import { addDays } from "@/lib/dates";
import { aiAvailable, generateReply, draftField, type AiMode } from "@/lib/ai";

export type ChatState = { error?: string } | undefined;

export async function startConversation(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const { mode } = parse(z.object({ mode: z.enum(["COACH", "PRACTICE", "SESSION_PREP"]) }), fd);
  const profile = await db.profile.findUnique({ where: { userId: u.id } });
  if (profile && !profile.aiEnabled) redirect("/settings");
  const titles = { COACH: "Coaching conversation", PRACTICE: "Conversation practice", SESSION_PREP: "Session preparation" };
  const c = await db.aiConversation.create({
    data: { userId: u.id, mode, title: titles[mode], expiresAt: addDays(new Date(), profile?.aiRetentionDays ?? 90) },
  });
  redirect(`/companion/${c.id}`);
}

export async function sendMessage(_: ChatState, fd: FormData): Promise<ChatState> {
  const u = await requireUser("PARTICIPANT");
  const { id, content } = parse(z.object({ id: z.string(), content: z.string().trim().min(1).max(6000) }), fd);
  const convo = await db.aiConversation.findFirst({ where: { id, userId: u.id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!convo) return { error: "Conversation not found." };
  if (!aiAvailable()) return { error: "The AI Companion is not configured on this server (no ANTHROPIC_API_KEY)." };

  await db.aiMessage.create({ data: { conversationId: id, role: "user", content } });
  const history = [...convo.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })), { role: "user" as const, content }];
  try {
    const reply = await generateReply({ userId: u.id, mode: convo.mode as AiMode, history: history.slice(-20) });
    await db.aiMessage.create({
      data: { conversationId: id, role: "assistant", content: reply.text, citations: JSON.stringify(reply.citations.map((c) => ({ id: c.id, ref: c.ref }))) },
    });
    if (convo.messages.length === 0) {
      await db.aiConversation.update({ where: { id }, data: { title: content.slice(0, 60) } });
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return { error: "The companion is busy right now. Try again in a minute." };
    if (err instanceof Anthropic.AuthenticationError) return { error: "The AI key on this server is not valid." };
    if (err instanceof Anthropic.APIError) return { error: `The AI service returned an error (${err.status ?? "network"}).` };
    throw err;
  }
  revalidatePath(`/companion/${id}`);
  return undefined;
}

export async function deleteConversation(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const { id } = parse(z.object({ id: z.string() }), fd);
  await db.aiConversation.deleteMany({ where: { id, userId: u.id } });
  redirect("/companion");
}

export async function deleteAllConversations() {
  const u = await requireUser("PARTICIPANT");
  await db.aiConversation.deleteMany({ where: { userId: u.id } });
  revalidatePath("/companion");
  revalidatePath("/settings");
}

export type DraftKind = "destination" | "why" | "forgeStatement";

/** "Help me write this": returns draft text for the participant to edit. Saves nothing. */
export async function draftWithAI(kind: DraftKind): Promise<{ text: string } | { error: string }> {
  const u = await requireUser("PARTICIPANT");
  if (!["destination", "why", "forgeStatement"].includes(kind)) return { error: "Unknown field." };
  if (!aiAvailable()) return { error: "The AI Companion is not turned on for this site yet." };
  const profile = await db.profile.findUnique({ where: { userId: u.id } });
  if (profile && !profile.aiEnabled) return { error: "You turned the AI Companion off in Settings." };
  try {
    const text = await draftField(u.id, kind);
    return text ? { text } : { error: "No draft this time. Try writing a few words first." };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return { error: "The AI is busy right now. Try again in a minute." };
    if (err instanceof Anthropic.APIError) return { error: "The AI service could not draft this right now." };
    throw err;
  }
}
