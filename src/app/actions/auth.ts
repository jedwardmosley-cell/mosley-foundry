"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { parse } from "@/lib/validation";
import { randomBytes } from "node:crypto";
import { sha256, validResetToken } from "@/lib/resetTokens";
import { emailAvailable, sendEmail, appUrl } from "@/lib/email";

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
  await db.user.update({ where: { id: u.id }, data: { passwordHash: hashPassword(next), mustChangePassword: false, passwordResetAt: null, passwordResetBy: null } });
  await db.session.deleteMany({ where: { userId: u.id } });
  await createSession(u.id);
  return { ok: true };
}

// ---------- Forgot password ----------

const RESET_MINUTES = 60;
const RESETS_PER_HOUR = 3;


export type ForgotState = { sent?: boolean; error?: string } | undefined;

/**
 * Emails a one-time link to reset the password. The reply is the same whether or not the email
 * has an account, so the form can't be used to find out who is a client.
 */
export async function requestPasswordReset(_: ForgotState, fd: FormData): Promise<ForgotState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email" };
  if (!emailAvailable()) return { error: "Email isn't set up yet. Ask your coach to reset your password." };
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (user) {
    const recent = await db.passwordResetToken.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (recent < RESETS_PER_HOUR) {
      const token = randomBytes(32).toString("base64url");
      await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) } });
      const link = `${appUrl()}/reset?token=${token}`;
      const first = user.name.split(" ")[0];
      await sendEmail({
        to: user.email,
        subject: "Reset your Both Hands on the Wheel password",
        text: `Hi ${first},\n\nTap this link to pick a new password. It works once and expires in an hour.\n\n${link}\n\nIf you didn't ask for this, you can ignore this email. Your password stays the same.\n\nBoth Hands on the Wheel`,
        html: `<p>Hi ${escapeHtml(first)},</p><p>Tap the button to pick a new password. It works once and expires in an hour.</p><p><a href="${link}" style="display:inline-block;background:#15223A;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Pick a new password</a></p><p style="color:#4A5463;font-size:13px">If you didn't ask for this, you can ignore this email. Your password stays the same.</p><p style="color:#4A5463;font-size:13px">Both Hands on the Wheel</p>`,
      });
      await db.auditEvent.create({ data: { actorId: user.id, action: "password.reset_requested", targetUserId: user.id } });
    }
  }
  return { sent: true };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const resetSchema = z.object({
  token: z.string().min(1),
  next: z.string().min(10, "Use at least 10 characters").max(200),
  confirm: z.string(),
});

/** Sets a new password from a reset link, signs out every device, and sends the person to sign in. */
export async function resetPasswordWithToken(_: AuthState, fd: FormData): Promise<AuthState> {
  const r = resetSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0].message };
  if (r.data.next !== r.data.confirm) return { error: "The two passwords don't match." };
  const row = await validResetToken(r.data.token);
  if (!row) return { error: "This link has expired or was already used. Ask for a new one." };
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: hashPassword(r.data.next), mustChangePassword: false, passwordResetAt: null, passwordResetBy: null } }),
    db.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: row.userId } }),
    db.auditEvent.create({ data: { actorId: row.userId, action: "password.reset_by_email", targetUserId: row.userId } }),
  ]);
  redirect("/login?reset=1");
}
