import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { canCoach } from "./roles";

const COOKIE = "bhow_session";
const SESSION_DAYS = 14;

export type Role = "PARTICIPANT" | "COACH" | "ADMIN";
export type CurrentUser = { id: string; email: string; name: string; role: Role; orgId: string | null; isDemo: boolean; alsoCoach: boolean; mustChangePassword: boolean };


const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Creates a session. Only a hash of the token is stored, so a database leak does not leak sessions. */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  const u = s.user;
  return { id: u.id, email: u.email, name: u.name, role: u.role as Role, orgId: u.orgId, isDemo: u.isDemo, alsoCoach: u.alsoCoach, mustChangePassword: u.mustChangePassword };
}

/** Use at the top of every page and server action. Redirects when not signed in or wrong role. */
export async function requireUser(...roles: Role[]): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (roles.length && !roles.includes(u.role) && !(roles.includes("COACH") && canCoach(u))) redirect("/");
  return u;
}
