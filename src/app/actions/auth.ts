"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { parse } from "@/lib/validation";

export type AuthState = { error?: string } | undefined;

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  invite: z.string().optional(),
});

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  if (process.env.ALLOW_SIGNUP === "false") return { error: "Sign-up is by invitation. Ask your program administrator to enroll you." };
  const r = signUpSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0].message };
  const { name, email, password, invite } = r.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "An account with that email already exists. Sign in instead." };
  const user = await db.user.create({
    data: { name, email, passwordHash: hashPassword(password), role: "PARTICIPANT", profile: { create: {} } },
  });
  await createSession(user.id);
  redirect(invite ? `/invite/${encodeURIComponent(invite)}` : "/onboarding");
}

const signInSchema = z.object({ email: z.string().trim().toLowerCase(), password: z.string(), next: z.string().optional() });

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const { email, password, next } = parse(signInSchema, fd);
  const user = await db.user.findUnique({ where: { email } });
  // Same message for unknown email and wrong password.
  if (!user || !verifyPassword(password, user.passwordHash)) return { error: "That email and password don't match." };
  await createSession(user.id);
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(safeNext);
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}

export type PasswordState = { error?: string; ok?: boolean } | undefined;

const passwordSchema = z.object({
  current: z.string().min(1, "Enter your current password"),
  next: z.string().min(10, "Use at least 10 characters for the new password").max(200),
  confirm: z.string(),
});

/** Changes the signed-in person's password and signs out every other device. */
export async function changePassword(_: PasswordState, fd: FormData): Promise<PasswordState> {
  const u = await requireUser();
  const r = passwordSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0].message };
  const { current, next, confirm } = r.data;
  if (next !== confirm) return { error: "The two new passwords don't match." };
  if (next === current) return { error: "Choose a new password that is different from the current one." };
  const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!verifyPassword(current, row.passwordHash)) return { error: "The current password is wrong." };
  await db.user.update({ where: { id: u.id }, data: { passwordHash: hashPassword(next), mustChangePassword: false } });
  await db.session.deleteMany({ where: { userId: u.id } });
  await createSession(u.id);
  return { ok: true };
}
