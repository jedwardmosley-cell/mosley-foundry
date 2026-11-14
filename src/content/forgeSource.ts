import "server-only";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { parseForgeSource, type ForgeSource } from "./forgeParse";
export type { ForgeSource, ForgeCard } from "./forgeParse";

/**
 * FORGE SOURCE: all FORGE teaching comes from one markdown file, forge-source.md: Chapter 9
 * (The Rules of the Road), the approved sources, and the card wording, in the author's words.
 * It is book text, so it lives with the licensed pack (never in the public repo): a local file in
 * development, or uploaded to the database in production. Without it, cards show only the rule line.
 */
// Cached until the uploaded file changes: the stamp is the upload time in the database,
// so a new upload at /setup shows on every server at once.
let cached: { stamp: string; value: ForgeSource | null } | null = null;
export function clearForgeCache() { cached = null; }

function readLocal(): string | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), "src", "content", "licensed", "forge-source.md"), "utf8");
  } catch {
    return null;
  }
}

export async function getForgeSource(): Promise<ForgeSource | null> {
  const local = readLocal();
  if (local) return parseForgeSource(local); // development: always the file on disk
  let row: { json: string; updatedAt: Date } | null = null;
  try {
    row = await db.contentPack.findUnique({ where: { key: "forge-source" }, select: { json: true, updatedAt: true } });
  } catch {
    return cached?.value ?? null; // database unreachable: keep what we had
  }
  const stamp = row ? String(row.updatedAt.getTime()) : "none";
  if (cached && cached.stamp === stamp) return cached.value;
  let value: ForgeSource | null = null;
  try {
    value = row ? parseForgeSource((JSON.parse(row.json) as { md: string }).md) : null;
  } catch {
    value = null;
  }
  cached = { stamp, value };
  return value;
}
