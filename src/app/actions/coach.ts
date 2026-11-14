"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit, isActiveCoachOf, grantedScopes } from "@/lib/access";
import { parse, text } from "@/lib/validation";
import { exerciseText } from "@/lib/exercises";

async function coachFor(participantId: string) {
  const c = await requireUser("COACH");
  if (!(await isActiveCoachOf(c.id, participantId))) throw new Error("Not your participant.");
  return c;
}

export async function assignExercise(fd: FormData) {
  const d = parse(z.object({ participantId: z.string(), exerciseRef: z.string().max(60), title: z.string().trim().max(200).default(""), instructions: text(6000), dueOn: z.string().optional() }), fd);
  const c = await coachFor(d.participantId);
  const ex = await exerciseText(d.exerciseRef);
  if (ex) {
    d.title ||= ex.title;
    d.instructions ||= ex.text;
  }
  if (!d.title) throw new Error("Give the exercise a title.");
  await db.assignedExercise.create({
    data: { coachId: c.id, participantId: d.participantId, exerciseRef: d.exerciseRef, title: d.title, instructions: d.instructions, dueOn: d.dueOn ? new Date(d.dueOn + "T12:00:00") : null },
  });
  await audit(c, "coach.assign_exercise", d.participantId, d.exerciseRef);
  revalidatePath(`/coach/${d.participantId}`);
}

export async function scheduleSession(fd: FormData) {
  const d = parse(z.object({ participantId: z.string(), scheduledAt: z.string().min(10), agenda: text(3000) }), fd);
  const c = await coachFor(d.participantId);
  await db.coachingSession.create({ data: { coachId: c.id, participantId: d.participantId, scheduledAt: new Date(d.scheduledAt), agenda: d.agenda } });
  revalidatePath(`/coach/${d.participantId}`);
}

export async function saveSessionNotes(fd: FormData) {
  const d = parse(z.object({ id: z.string(), participantId: z.string(), coachNotes: text(8000), commitments: text(4000) }), fd);
  const c = await coachFor(d.participantId);
  await db.coachingSession.updateMany({ where: { id: d.id, coachId: c.id }, data: { coachNotes: d.coachNotes, commitments: d.commitments } });
  revalidatePath(`/coach/${d.participantId}`);
}

/** A coach may record an interpretation only on a priority the participant has already chosen to share. */
export async function recordEqiInterpretation(fd: FormData) {
  const d = parse(z.object({ id: z.string(), participantId: z.string(), coachInterpretation: text(3000) }), fd);
  const c = await coachFor(d.participantId);
  const scopes = await grantedScopes(c, d.participantId);
  if (!scopes.has("EQI")) throw new Error("The participant has not shared what they're working on from their feedback.");
  // Recording resets approval: the participant must approve the new wording before it is shared again.
  await db.eqiPriority.updateMany({
    where: { id: d.id, userId: d.participantId, participantApproved: true },
    data: { coachInterpretation: d.coachInterpretation, interpretationBy: c.id, participantApproved: false },
  });
  await audit(c, "coach.eqi_interpretation", d.participantId);
  revalidatePath(`/coach/${d.participantId}`);
}
