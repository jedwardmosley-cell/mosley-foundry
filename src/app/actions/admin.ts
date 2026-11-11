"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { parse, text } from "@/lib/validation";
import { defaultSchedule } from "@/content/program";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const admin = () => requireUser("ADMIN");

/** Admins act only inside their own organization. */
async function cohortInOrg(cohortId: string, orgId: string | null) {
  const c = await db.cohort.findFirst({ where: { id: cohortId, orgId: orgId ?? "__none__" } });
  if (!c) throw new Error("Cohort not found in your organization.");
  return c;
}

export async function createCohort(fd: FormData) {
  const a = await admin();
  if (!a.orgId) throw new Error("Admin has no organization.");
  const d = parse(z.object({ name: z.string().trim().min(1).max(120), deliveryFormat: z.enum(["THREE_DAY", "THREE_WEEK"]), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reinforceDays: z.coerce.number().int().min(30).max(180) }), fd);
  const start = new Date(d.startDate + "T00:00:00");
  const cohort = await db.cohort.create({
    data: {
      orgId: a.orgId, name: d.name, deliveryFormat: d.deliveryFormat, startDate: start, reinforceDays: d.reinforceDays,
      sessions: { create: defaultSchedule(start, d.deliveryFormat) },
    },
  });
  redirect(`/admin/cohorts/${cohort.id}`);
}

export async function updateSession(fd: FormData) {
  const a = await admin();
  const d = parse(z.object({ id: z.string(), cohortId: z.string(), startsAt: z.string().min(10), facilitatorId: z.string().optional(), location: text(200) }), fd);
  await cohortInOrg(d.cohortId, a.orgId);
  await db.trainingSession.updateMany({
    where: { id: d.id, cohortId: d.cohortId },
    data: { startsAt: new Date(d.startsAt), facilitatorId: d.facilitatorId || null, location: d.location },
  });
  revalidatePath(`/admin/cohorts/${d.cohortId}`);
}

/** Enrolls a person by email. Creates an account with a one-time password shown to the admin once. */
export async function enroll(fd: FormData): Promise<void> {
  const a = await admin();
  const d = parse(z.object({ cohortId: z.string(), name: z.string().trim().min(1).max(120), email: z.string().trim().toLowerCase().email(), role: z.enum(["PARTICIPANT", "FACILITATOR"]) }), fd);
  await cohortInOrg(d.cohortId, a.orgId);
  let user = await db.user.findUnique({ where: { email: d.email } });
  let tempPassword: string | null = null;
  if (!user) {
    tempPassword = randomBytes(9).toString("base64url");
    user = await db.user.create({
      data: { email: d.email, name: d.name, passwordHash: hashPassword(tempPassword), mustChangePassword: true, role: d.role === "FACILITATOR" ? "COACH" : "PARTICIPANT", orgId: a.orgId, profile: { create: { pathway: "LEADING_OTHERS" } } },
    });
  } else if (user.orgId && user.orgId !== a.orgId) {
    throw new Error("That person belongs to another organization.");
  }
  await db.cohortMember.upsert({
    where: { cohortId_userId: { cohortId: d.cohortId, userId: user.id } },
    create: { cohortId: d.cohortId, userId: user.id, role: d.role },
    update: { role: d.role },
  });
  revalidatePath(`/admin/cohorts/${d.cohortId}`);
  if (tempPassword) {
    // Shown once to the admin via a short-lived, httpOnly cookie (never in the URL or logs).
    (await cookies()).set("enroll_flash", JSON.stringify({ email: d.email, temp: tempPassword }), {
      httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 120, path: "/admin",
    });
  }
}

export async function markAttendance(fd: FormData) {
  const a = await admin();
  const d = parse(z.object({ cohortId: z.string(), sessionId: z.string(), userId: z.string(), status: z.enum(["PRESENT", "ABSENT", "EXCUSED"]) }), fd);
  await cohortInOrg(d.cohortId, a.orgId);
  const s = await db.trainingSession.findFirst({ where: { id: d.sessionId, cohortId: d.cohortId } });
  const m = await db.cohortMember.findFirst({ where: { cohortId: d.cohortId, userId: d.userId } });
  if (!s || !m) throw new Error("Not found");
  await db.attendance.upsert({
    where: { sessionId_userId: { sessionId: s.id, userId: d.userId } },
    create: { sessionId: s.id, userId: d.userId, status: d.status },
    update: { status: d.status },
  });
  revalidatePath(`/admin/cohorts/${d.cohortId}`);
}

/** Assigning a coach grants no data access. The participant decides what to share. */
export async function assignCoach(fd: FormData) {
  const a = await admin();
  const d = parse(z.object({ cohortId: z.string(), coachId: z.string(), participantId: z.string() }), fd);
  await cohortInOrg(d.cohortId, a.orgId);
  const [coach, p] = await Promise.all([
    db.user.findFirst({ where: { id: d.coachId, orgId: a.orgId, OR: [{ role: "COACH" }, { role: "ADMIN", alsoCoach: true }] } }),
    db.cohortMember.findFirst({ where: { cohortId: d.cohortId, userId: d.participantId, role: "PARTICIPANT" } }),
  ]);
  if (!coach || !p) throw new Error("Not found");
  await db.coachAssignment.upsert({
    where: { coachId_participantId: { coachId: coach.id, participantId: d.participantId } },
    create: { coachId: coach.id, participantId: d.participantId },
    update: { active: true },
  });
  revalidatePath(`/admin/cohorts/${d.cohortId}`);
}

/** Lets the signed-in administrator also act as a coach. Coach privacy rules still apply to them. */
export async function setAlsoCoach(fd: FormData) {
  const a = await admin();
  const { on } = parse(z.object({ on: z.enum(["true", "false"]) }), fd);
  await db.user.update({ where: { id: a.id }, data: { alsoCoach: on === "true" } });
  revalidatePath("/", "layout");
}
