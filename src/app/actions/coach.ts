"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit, isActiveCoachOf, grantedScopes } from "@/lib/access";
import { parse, text } from "@/lib/validation";
import { exerciseText } from "@/lib/exercises";
import { fromWallTime } from "@/lib/zone";
import { formZone } from "@/lib/userZone";

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
  redirect(`/coach/${d.participantId}?saved=assigned#assignments`);
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
  // The coach typed their own local time.
  const at = fromWallTime(d.scheduledAt, await formZone(c, fd));
  if (!at) throw new Error("Pick a day and a time.");
  await db.coachingSession.create({ data: { coachId: c.id, participantId: d.participantId, scheduledAt: at, agenda: d.agenda } });
  revalidatePath(`/coach/${d.participantId}`);
  redirect(`/coach/${d.participantId}?saved=booked#sessions`);
}

export async function saveSessionNotes(fd: FormData) {
  const d = parse(z.object({ id: z.string(), participantId: z.string(), coachNotes: text(8000), commitments: text(4000) }), fd);
  const c = await coachFor(d.participantId);
  await db.coachingSession.updateMany({ where: { id: d.id, coachId: c.id }, data: { coachNotes: d.coachNotes, commitments: d.commitments } });
  revalidatePath(`/coach/${d.participantId}`);
  redirect(`/coach/${d.participantId}?saved=notes#sessions`);
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
  const { instruction, participantId } = parse(z.object({ instruction: z.string().trim().min(3).max(4000), participantId: z.string().optional() }), fd);
  if (participantId && !(await isActiveCoachOf(c.id, participantId))) throw new Error("Not your participant.");
  const { planForCoach } = await import("@/lib/coachAssistant");
  const r = await planForCoach(c, instruction, participantId);
  await audit(c, "coach.assistant_plan", participantId, r.ok ? r.draftId : r.reason);
  const base = participantId ? `/coach/${participantId}` : "/coach";
  redirect(r.ok ? `${base}?draft=${r.draftId}#assistant` : `${base}?assistant=${r.reason}#assistant`);
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
  const zone = await formZone(c, fd);
  if (!draft) redirect("/coach");
  let done = 0;
  for (const [i, a] of draft.plan.actions.entries()) {
    if (fd.get(`do_${i}`) !== "on") continue;
    if (!(await isActiveCoachOf(c.id, a.participantId))) continue;
    if (a.type === "assign_exercise") {
      const due = String(fd.get(`due_${i}`) ?? a.dueOn);
      await assignFor(c, { participantId: a.participantId, exerciseRef: a.exerciseRef, title: a.exerciseRef === "custom" ? String(fd.get(`title_${i}`) ?? a.title).trim().slice(0, 200) : "", instructions: a.exerciseRef === "custom" ? a.instructions : "", dueOn: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : undefined });
    } else {
      const at = fromWallTime(String(fd.get(`when_${i}`) ?? a.when), zone);
      if (!at) continue;
      await db.coachingSession.create({ data: { coachId: c.id, participantId: a.participantId, scheduledAt: at, agenda: a.agenda } });
      await audit(c, "coach.schedule_session", a.participantId, "assistant");
    }
    revalidatePath(`/coach/${a.participantId}`);
    done += 1;
  }
  await db.coachDraft.deleteMany({ where: { id: draftId, coachId: c.id } });
  revalidatePath("/coach");
  const back = String(fd.get("back") ?? "");
  redirect(back && (await isActiveCoachOf(c.id, back)) ? `/coach/${back}?done=${done}#assistant` : `/coach?done=${done}#assistant`);
}

export async function cancelCoachDraft(fd: FormData) {
  const c = await requireUser("COACH");
  const { draftId } = parse(z.object({ draftId: z.string() }), fd);
  await db.coachDraft.deleteMany({ where: { id: draftId, coachId: c.id } });
  const back = String(fd.get("back") ?? "");
  redirect(back && (await isActiveCoachOf(c.id, back)) ? `/coach/${back}#assistant` : "/coach#assistant");
}

/** After-session wrap-up, step 1: draft from the coach's rough notes. Nothing is saved to the session yet. */
export async function draftSessionWrapUp(fd: FormData) {
  const d = parse(z.object({ participantId: z.string(), rough: z.string().trim().min(3).max(8000) }), fd);
  const c = await coachFor(d.participantId);
  const { draftWrapUp } = await import("@/lib/coachBrief");
  const r = await draftWrapUp(c, d.participantId, d.rough);
  await audit(c, "coach.wrapup_draft", d.participantId, r.ok ? "ok" : r.reason);
  redirect(r.ok ? `/coach/${d.participantId}?wrap=${r.draftId}#wrapup` : `/coach/${d.participantId}?wrapnote=${r.reason}#wrapup`);
}

/**
 * After-session wrap-up, step 2: save what the coach kept. Notes stay private to the coach; commitments are what the
 * client sees. With no past session on record, one is added for today so the notes have a home.
 */
export async function saveSessionWrapUp(fd: FormData) {
  const d = parse(z.object({ participantId: z.string(), draftId: z.string(), coachNotes: text(8000), commitments: text(4000), assign: z.string().optional() }), fd);
  const c = await coachFor(d.participantId);
  const { getWrapUp } = await import("@/lib/coachBrief");
  const w = await getWrapUp(c.id, d.participantId, d.draftId);
  if (!w) redirect(`/coach/${d.participantId}#wrapup`);
  const existing = w.draft.sessionId ? await db.coachingSession.findFirst({ where: { id: w.draft.sessionId, coachId: c.id, participantId: d.participantId } }) : null;
  if (existing) {
    const notes = existing.coachNotes ? `${existing.coachNotes}\n\n${d.coachNotes}` : d.coachNotes;
    await db.coachingSession.update({ where: { id: existing.id }, data: { coachNotes: notes, commitments: d.commitments || existing.commitments } });
  } else {
    await db.coachingSession.create({ data: { coachId: c.id, participantId: d.participantId, scheduledAt: new Date(), coachNotes: d.coachNotes, commitments: d.commitments } });
  }
  if (d.assign === "on" && w.draft.exercise) await assignFor(c, { participantId: d.participantId, exerciseRef: w.draft.exercise.ref, title: "", instructions: "" });
  await db.coachDraft.deleteMany({ where: { id: d.draftId, coachId: c.id } });
  await audit(c, "coach.wrapup_saved", d.participantId);
  revalidatePath(`/coach/${d.participantId}`);
  redirect(`/coach/${d.participantId}?wrapped=1#wrapup`);
}

export async function discardSessionWrapUp(fd: FormData) {
  const d = parse(z.object({ participantId: z.string(), draftId: z.string() }), fd);
  const c = await coachFor(d.participantId);
  await db.coachDraft.deleteMany({ where: { id: d.draftId, coachId: c.id } });
  redirect(`/coach/${d.participantId}#wrapup`);
}

/** Cohort session prep: only a facilitator of that cohort, and only from group totals. */
export async function prepareCohortSession(fd: FormData) {
  const c = await requireUser("COACH");
  const d = parse(z.object({ cohortId: z.string(), minutes: z.coerce.number().int().min(30).max(480).default(120) }), fd);
  const isFacilitator = await db.cohortMember.findFirst({ where: { cohortId: d.cohortId, userId: c.id, role: "FACILITATOR" } });
  if (!isFacilitator) throw new Error("You don't facilitate this cohort.");
  const { aiAvailable, cohortPrepAI } = await import("@/lib/ai");
  if (!aiAvailable()) redirect(`/coach/cohorts?prepnote=ai_off#cohort-${d.cohortId}`);
  const { cohortPulse } = await import("@/lib/reports");
  const pulse = await cohortPulse(d.cohortId);
  const prep = await cohortPrepAI(pulse.text, d.minutes);
  await audit(c, "coach.cohort_prep", undefined, `${d.cohortId}:${prep ? "ok" : "failed"}`);
  if (!prep) redirect(`/coach/cohorts?prepnote=failed#cohort-${d.cohortId}`);
  await db.cohortBrief.create({ data: { coachId: c.id, cohortId: d.cohortId, segmentKey: pulse.segmentKey, content: JSON.stringify({ ...prep, small: pulse.small, minutes: d.minutes }) } });
  revalidatePath("/coach/cohorts");
  redirect(`/coach/cohorts#cohort-${d.cohortId}`);
}

/** Change an assignment the coach gave: title, instructions, due date. Only the coach's own, for their own client. */
export async function updateExercise(fd: FormData) {
  const d = parse(z.object({ id: z.string(), participantId: z.string(), title: z.string().trim().min(1).max(200), instructions: text(6000), dueOn: z.string().optional() }), fd);
  const c = await coachFor(d.participantId);
  await db.assignedExercise.updateMany({
    where: { id: d.id, coachId: c.id, participantId: d.participantId },
    data: { title: d.title, instructions: d.instructions, dueOn: d.dueOn ? new Date(d.dueOn + "T12:00:00") : null },
  });
  await audit(c, "coach.update_exercise", d.participantId, d.id);
  revalidatePath(`/coach/${d.participantId}`);
  redirect(`/coach/${d.participantId}?saved=exercise#assignments`);
}

/** Take back an assignment. The client's response, if any, goes with it. */
export async function deleteExercise(fd: FormData) {
  const d = parse(z.object({ id: z.string(), participantId: z.string() }), fd);
  const c = await coachFor(d.participantId);
  await db.assignedExercise.deleteMany({ where: { id: d.id, coachId: c.id, participantId: d.participantId } });
  await audit(c, "coach.delete_exercise", d.participantId, d.id);
  revalidatePath(`/coach/${d.participantId}`);
  redirect(`/coach/${d.participantId}?saved=removed#assignments`);
}

/** Move a session or change its agenda. */
export async function updateSession(fd: FormData) {
  const d = parse(z.object({ id: z.string(), participantId: z.string(), scheduledAt: z.string().min(10), agenda: text(3000) }), fd);
  const c = await coachFor(d.participantId);
  const at = fromWallTime(d.scheduledAt, await formZone(c, fd));
  if (!at) throw new Error("Pick a day and a time.");
  await db.coachingSession.updateMany({ where: { id: d.id, coachId: c.id, participantId: d.participantId }, data: { scheduledAt: at, agenda: d.agenda } });
  await audit(c, "coach.update_session", d.participantId, d.id);
  revalidatePath(`/coach/${d.participantId}`);
  redirect(`/coach/${d.participantId}?saved=session#sessions`);
}

export async function deleteSession(fd: FormData) {
  const d = parse(z.object({ id: z.string(), participantId: z.string() }), fd);
  const c = await coachFor(d.participantId);
  await db.coachingSession.deleteMany({ where: { id: d.id, coachId: c.id, participantId: d.participantId } });
  await audit(c, "coach.delete_session", d.participantId, d.id);
  revalidatePath(`/coach/${d.participantId}`);
  redirect(`/coach/${d.participantId}?saved=removed-session#sessions`);
}
