"use server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/access";
import { hashPassword } from "@/lib/password";

export type ClientState = { error?: string; ok?: string; temp?: { email: string; password: string }; values?: { name: string; email: string } } | undefined;

const schema = z.object({
  name: z.string().trim().min(1, "Enter the client's name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

/**
 * A coach adds a client directly, without a cohort. Being someone's coach shares nothing:
 * the client still chooses what the coach can see.
 */
export async function addClient(_: ClientState, fd: FormData): Promise<ClientState> {
  const coach = await requireUser("COACH");
  const values = { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? "") };
  const r = schema.safeParse(values);
  if (!r.success) return { error: r.error.issues[0].message, values };
  const { name, email } = r.data;
  if (email === coach.email) return { error: "That is your own email.", values };

  let user = await db.user.findUnique({ where: { email } });
  let temp: { email: string; password: string } | undefined;
  if (user) {
    if (user.role !== "PARTICIPANT") return { error: "That email belongs to a coach or administrator account.", values };
    if (user.orgId && user.orgId !== coach.orgId) return { error: "That person belongs to another organization.", values };
  } else {
    const password = randomBytes(9).toString("base64url");
    user = await db.user.create({
      data: { email, name, role: "PARTICIPANT", orgId: coach.orgId, passwordHash: hashPassword(password), profile: { create: {} } },
    });
    temp = { email, password };
  }
  await db.coachAssignment.upsert({
    where: { coachId_participantId: { coachId: coach.id, participantId: user.id } },
    create: { coachId: coach.id, participantId: user.id },
    update: { active: true },
  });
  await audit(coach, "coach.add_client", user.id);
  revalidatePath("/coach");
  return { ok: temp ? `Account created for ${name}.` : `${user.name} already had an account and is now on your list.`, temp };
}

/** Ends the coaching link and clears what the client had shared with this coach. */
export async function removeClient(fd: FormData) {
  const coach = await requireUser("COACH");
  const { participantId } = z.object({ participantId: z.string() }).parse({ participantId: fd.get("participantId") });
  const n = await db.coachAssignment.updateMany({ where: { coachId: coach.id, participantId }, data: { active: false } });
  if (!n.count) throw new Error("Not found");
  await db.shareGrant.deleteMany({ where: { ownerId: participantId, granteeId: coach.id } });
  await audit(coach, "coach.remove_client", participantId);
  revalidatePath("/coach");
  redirect("/coach");
}
