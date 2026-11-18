"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  await assignFor(c, d);
  revalidatePath(`/coach/${d.participantId}`);
}

/** One exercise for one of the coach's own clients. Program exercises fill in their own title and text. */
async function assignFor(c: Awaited<ReturnType<typeof coachFor>>, d: { participantId: string; exerciseRef: string; title: string; instructions: string; dueOn?: string }) {
  const ex = await exerciseText(d.exerciseRef);
  const title = d.title || ex?.title || "";
  const instructions = d.instructions || ex?.text || "";
  if (!title) throw new Error("Give the exercise a title.");
  await db.assignedExercise.create({
    data: { coachId: c.id, participantId: d.participantId, exerciseRef: d.exerciseRef, title, instructions, dueOn: d.dueOn ? new Date(d.dueOn + "T12:00:00") : null },
  });
  await audit(c, "coach.assign_exercise", d.participantId, d.exerciseRef);
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

/** Session prep: build a fresh AI brief from what the client shares with this coach. */
export async function prepareSessionBrief(fd: FormData) {
  const d = parse(z.object({ participantId: z.string() }), fd);
  const c = await coachFor(d.participantId);
  const { prepareBrief } = await import("@/lib/coachBrief");
  const r = await prepareBrief(c, d.participantId);
  await audit(c, "coach.session_brief", d.participantId, r.ok ? "ok" : r.reason);
  revalidatePath(`/coach/${d.participantId}`);
  redirect(`/coach/${d.participantId}?brief=${r.ok ? "new" : r.reason}#prep`);
}

/** The coach assistant, step 1: turn the coach's words into a plan to approve. Nothing is done yet. */
export async function planCoachActions(fd: FormData) {
  const c = await requireUser("COACH");
  const { instruction } = parse(z.object({ instruction: z.string().trim().min(3).max(4000) }), fd);
  const { planForCoach } = await import("@/lib/coachAssistant");
  const r = await planForCoach(c, instruction);
  await audit(c, "coach.assistant_plan", undefined, r.ok ? r.draftId : r.reason);
  redirect(r.ok ? `/coach?draft=${r.draftId}#assistant` : `/coach?assistant=${r.reason}#assistant`);
}

/**
 * The coach assistant, step 2: do the actions the coach ticked, with any dates or titles they changed.
 * Each one is checked again against the coach's own active clients before anything is written.
 */
export async function runCoachDraft(fd: FormData) {
  const c = await requireUser("COACH");
  const { draftId } = parse(z.object({ draftId: z.string() }), fd);
  const { getDraft } = await import("@/lib/coachAssistant");
  const draft = await getDraft(c.id, draftId);
  if (!draft) redirect("/coach");
  let done = 0;
  for (const [i, a] of draft.plan.actions.entries()) {
    if (fd.get(`do_${i}`) !== "on") continue;
    if (!(await isActiveCoachOf(c.id, a.participantId))) continue;
    if (a.type === "assign_exercise") {
      const due = String(fd.get(`due_${i}`) ?? a.dueOn);
      await assignFor(c, { participantId: a.participantId, exerciseRef: a.exerciseRef, title: a.exerciseRef === "custom" ? String(fd.get(`title_${i}`) ?? a.title).trim().slice(0, 200) : "", instructions: a.exerciseRef === "custom" ? a.instructions : "", dueOn: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : undefined });
    } else {
      const when = String(fd.get(`when_${i}`) ?? a.when);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(when)) continue;
      await db.coachingSession.create({ data: { coachId: c.id, participantId: a.participantId, scheduledAt: new Date(when), agenda: a.agenda } });
      await audit(c, "coach.schedule_session", a.participantId, "assistant");
    }
    revalidatePath(`/coach/${a.participantId}`);
    done += 1;
  }
  await db.coachDraft.deleteMany({ where: { id: draftId, coachId: c.id } });
  revalidatePath("/coach");
  redirect(`/coach?done=${done}#assistant`);
}

export async function cancelCoachDraft(fd: FormData) {
  const c = await requireUser("COACH");
  const { draftId } = parse(z.object({ draftId: z.string() }), fd);
  await db.coachDraft.deleteMany({ where: { id: draftId, coachId: c.id } });
  redirect("/coach#assistant");
}
