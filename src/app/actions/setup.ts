"use server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { clearContentCache } from "@/content";

export type SetupState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

function tokenOk(given: unknown) {
  const expected = process.env.SETUP_TOKEN ?? "";
  if (expected.length < 16 || typeof given !== "string") return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const adminSchema = z.object({
  org: z.string().trim().min(1, "Enter an organization name").max(120),
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(12, "Use at least 12 characters").max(200),
});

/** Creates the first administrator and organization. Only works while no administrator exists. */
export async function createFirstAdmin(_: SetupState, fd: FormData): Promise<SetupState> {
  // Echo back non-secret fields so a mistake does not wipe the form.
  const values = { org: String(fd.get("org") ?? ""), name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? "") };
  const fail = (error: string) => ({ error, values });
  if (!tokenOk(fd.get("token"))) return fail("Setup token is missing or wrong.");
  if (await db.user.count({ where: { role: "ADMIN", isDemo: false } })) return fail("An administrator already exists. Sign in instead.");
  const r = adminSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0].message);
  if (await db.user.findUnique({ where: { email: r.data.email } })) return fail("That email is already registered.");
  const org = await db.organization.create({ data: { name: r.data.org } });
  await db.user.create({ data: { email: r.data.email, name: r.data.name, role: "ADMIN", orgId: org.id, passwordHash: hashPassword(r.data.password) } });
  revalidatePath("/setup");
  return { ok: "Administrator created. You can sign in now." };
}

function looksLikePack(x: unknown): boolean {
  const p = x as { kind?: string; pillars?: unknown[]; chapters?: unknown[] };
  return p?.kind === "licensed" && Array.isArray(p.pillars) && p.pillars.length === 5 && Array.isArray(p.chapters);
}
function looksLikeEntrepreneur(x: unknown): boolean {
  const p = x as { pillars?: Record<string, unknown>; owner?: unknown };
  return !!p?.pillars && ["F", "O", "R", "G", "E"].every((k) => k in p.pillars!) && !!p.owner;
}

/** Stores the licensed content pack in the database. Requires the setup token every time. */
export async function uploadContent(_: SetupState, fd: FormData): Promise<SetupState> {
  if (!tokenOk(fd.get("token"))) return { error: "Setup token is missing or wrong." };
  const done: string[] = [];
  for (const [field, key, check] of [["pack", "pack", looksLikePack], ["entrepreneur", "entrepreneur", looksLikeEntrepreneur]] as const) {
    const f = fd.get(field);
    if (!(f instanceof File) || f.size === 0) continue;
    if (f.size > 2_000_000) return { error: `${f.name} is too large.` };
    let json: unknown;
    try { json = JSON.parse(await f.text()); } catch { return { error: `${f.name} is not valid JSON.` }; }
    if (!check(json)) return { error: `${f.name} does not look like the ${key === "pack" ? "pack.json" : "entrepreneur.json"} file.` };
    await db.contentPack.upsert({ where: { key }, create: { key, json: JSON.stringify(json) }, update: { json: JSON.stringify(json) } });
    done.push(f.name);
  }
  if (!done.length) return { error: "Choose at least one file." };
  clearContentCache();
  revalidatePath("/", "layout");
  return { ok: `Installed: ${done.join(", ")}` };
}
