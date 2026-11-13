import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Finds a reset link that is unused and not expired, or null. Only the hash is ever stored. */
export async function validResetToken(token: string) {
  if (!token || token.length > 200) return null;
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  return row && !row.usedAt && row.expiresAt > new Date() ? row : null;
}
