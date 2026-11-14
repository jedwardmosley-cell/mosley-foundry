"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { FEEDBACK_SOURCES, FEEDBACK_MAX_BYTES, FEEDBACK_FILE_TYPES, type FeedbackSource } from "@/content/feedback";

export type FeedbackState = { error?: string } | undefined;

const PILLARS = ["F", "O", "R", "G", "E"];
const schema = z.object({
  id: z.string().optional(),
  source: z.enum(Object.keys(FEEDBACK_SOURCES) as [FeedbackSource, ...FeedbackSource[]], { errorMap: () => ({ message: "Choose where it came from." }) }),
  title: z.string().trim().max(160).optional(),
  takenOn: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).optional().or(z.literal("")),
  summary: z.string().trim().max(8000),
});

function revalidate(id?: string) {
  revalidatePath("/feedback");
  if (id) revalidatePath(`/feedback/${id}`);
  revalidatePath("/assessment", "layout");
}

/**
 * Saves a My feedback entry: the source, the client's own summary, the pillars it speaks to,
 * and an optional file of their own notes. The client confirms it is their summary, not the report.
 */
export async function saveFeedback(_: FeedbackState, fd: FormData): Promise<FeedbackState> {
  const u = await requireUser("PARTICIPANT");
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (fd.get("ownSummary") !== "on") return { error: "Please confirm this is your own summary or notes, not the full report." };
  const file = fd.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!d.summary && !hasFile) return { error: "Write a short summary, add a file of your notes, or both." };
  let fileData: { fileName: string; fileType: string; fileSize: number; fileData: Uint8Array<ArrayBuffer> } | null = null;
  if (hasFile) {
    if (file.size > FEEDBACK_MAX_BYTES) return { error: "That file is over 4 MB. Try a smaller file or a photo of one page." };
    if (!FEEDBACK_FILE_TYPES[file.type]) return { error: "That kind of file can't be added. Use a PDF, a Word document or a photo." };
    fileData = { fileName: file.name.slice(0, 200), fileType: file.type, fileSize: file.size, fileData: new Uint8Array(await file.arrayBuffer()) };
  }
  const pillars = JSON.stringify(fd.getAll("pillars").map(String).filter((p) => PILLARS.includes(p)));
  const takenOn = d.takenOn ? new Date((d.takenOn.length === 7 ? `${d.takenOn}-01` : d.takenOn) + "T12:00:00") : null;
  const data = { source: d.source, title: d.title || FEEDBACK_SOURCES[d.source], takenOn, summary: d.summary, pillars, ownSummary: true, ...(fileData ?? {}) };
  let id = d.id;
  if (id) {
    const n = await db.feedback.updateMany({ where: { id, userId: u.id }, data });
    if (!n.count) return { error: "That entry wasn't found." };
  } else {
    id = (await db.feedback.create({ data: { ...data, userId: u.id } })).id;
  }
  revalidate(id);
  redirect(`/feedback/${id}`);
}

/** Share one entry with the assigned coach, or stop sharing it. Sharing turns on the My feedback scope for that coach. */
export async function setFeedbackShare(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const id = String(fd.get("id") ?? "");
  const on = fd.get("on") === "true";
  const f = await db.feedback.findFirst({ where: { id, userId: u.id } });
  if (!f) throw new Error("Not found");
  if (on) {
    const coaches = await db.coachAssignment.findMany({ where: { participantId: u.id, active: true } });
    if (!coaches.length) throw new Error("No coach is assigned to you yet.");
    for (const c of coaches) {
      await db.shareGrant.upsert({
        where: { ownerId_granteeId_scope: { ownerId: u.id, granteeId: c.coachId, scope: "FEEDBACK" } },
        create: { ownerId: u.id, granteeId: c.coachId, scope: "FEEDBACK" },
        update: {},
      });
    }
  }
  await db.feedback.update({ where: { id }, data: { shareCoach: on } });
  revalidate(id);
  revalidatePath("/sharing");
}

/** Lets the AI companion read this entry's summary (never the file), or stops it. */
export async function setFeedbackAi(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const id = String(fd.get("id") ?? "");
  const n = await db.feedback.updateMany({ where: { id, userId: u.id }, data: { allowAi: fd.get("on") === "true" } });
  if (!n.count) throw new Error("Not found");
  revalidate(id);
}

export async function removeFeedbackFile(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const id = String(fd.get("id") ?? "");
  await db.feedback.updateMany({ where: { id, userId: u.id }, data: { fileName: null, fileType: null, fileSize: null, fileData: null } });
  revalidate(id);
}

/** Deletes an entry and its file. Its priorities are kept, unlinked. */
export async function deleteFeedback(fd: FormData) {
  const u = await requireUser("PARTICIPANT");
  const id = String(fd.get("id") ?? "");
  await db.feedback.deleteMany({ where: { id, userId: u.id } });
  revalidate();
  redirect("/feedback");
}
