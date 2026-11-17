"use server";
import Anthropic from "@anthropic-ai/sdk";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parse, bool } from "@/lib/validation";
import { aiAvailable, readSelfTalkAI } from "@/lib/ai";
import { findClosedDoors, soundsLikeDistress, bookQuestions } from "@/lib/tone";
import { getContent } from "@/content";

const participant = () => requireUser("PARTICIPANT");

/**
 * Set the Tone: save what the client said to themselves, find closed-door phrases by rule,
 * and, when Help me with this is on, read it against their FORGE identity. Distress skips coaching.
 */
export async function readSelfTalk(fd: FormData) {
  const u = await participant();
  const { said } = parse(z.object({ said: z.string().trim().min(3, "Write a few words first.").max(3000) }), fd);
  const doors = findClosedDoors(said);
  const entry = await db.toneEntry.create({ data: { userId: u.id, text: said, closedDoor: JSON.stringify(doors.map((d) => d.label)) } });
  revalidatePath("/tone");
  if (soundsLikeDistress(said)) redirect(`/tone?entry=${entry.id}&care=1`);

  const profile = await db.profile.findUnique({ where: { userId: u.id }, select: { aiEnabled: true } });
  if (!aiAvailable() || profile?.aiEnabled === false) redirect(`/tone?entry=${entry.id}&ai=off`);
  let note = "";
  try {
    const { pack } = await getContent();
    const reading = await readSelfTalkAI(u.id, said, doors.map((d) => d.said), bookQuestions(pack.chapters));
    if (reading) await db.toneEntry.update({ where: { id: entry.id }, data: { reading: JSON.stringify(reading) } });
    else note = "none";
  } catch (err) {
    if (err instanceof Anthropic.APIError) note = "busy";
    else throw err;
  }
  redirect(`/tone?entry=${entry.id}${note ? `&ai=${note}` : ""}`);
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

