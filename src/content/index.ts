import "server-only";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { publicPack } from "./public-pack";
import type { ContentPack, EntrepreneurPack, PillarKey } from "./types";

type Loaded = { pack: ContentPack; entrepreneur: EntrepreneurPack | null };
// Keyed by the database rows' update times, so an upload at /setup is picked up on the next request
// in every server bundle (Next.js keeps separate module copies for pages and server actions).
let cached: { stamp: string; value: Loaded } | null = null;

function readFile<T>(file: string): T | null {
  const p = path.join(process.cwd(), "src", "content", "licensed", file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

async function dbStamp(): Promise<string> {
  try {
    const rows = await db.contentPack.findMany({ select: { key: true, updatedAt: true }, orderBy: { key: "asc" } });
    return rows.map((r) => `${r.key}:${r.updatedAt.getTime()}`).join("|");
  } catch {
    return "db-unavailable"; // database unreachable: fall back rather than break every page
  }
}

async function readDb<T>(key: string): Promise<T | null> {
  try {
    const row = await db.contentPack.findUnique({ where: { key } });
    return row ? (JSON.parse(row.json) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Loads the licensed content pack. Order: local files (development), then the
 * database (production, uploaded at /setup), then the public draft fallback.
 */
export async function getContent(): Promise<Loaded> {
  const stamp = await dbStamp();
  if (cached && cached.stamp === stamp) return cached.value;
  const pack = readFile<ContentPack>("pack.json") ?? (await readDb<ContentPack>("pack"));
  const entrepreneur = readFile<EntrepreneurPack>("entrepreneur.json") ?? (await readDb<EntrepreneurPack>("entrepreneur"));
  const value = { pack: pack ?? publicPack, entrepreneur };
  cached = { stamp, value };
  return value;
}

export function clearContentCache() {
  cached = null;
}

export async function pillar(key: PillarKey) {
  return (await getContent()).pack.pillars.find((p) => p.key === key)!;
}
