import "server-only";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { publicPack } from "./public-pack";
import { cleanPack, cleanEntrepreneur } from "./clean";
import { getForgeSource } from "./forgeSource";
import type { ContentPack, EntrepreneurPack, PillarKey } from "./types";

type Loaded = { pack: ContentPack; entrepreneur: EntrepreneurPack | null };
// Keyed by the database rows' update times, so an upload at /setup is picked up on the next request
// in every server bundle (Next.js keeps separate module copies for pages and server actions). One copy per edition.
const cached = new Map<string, { stamp: string; value: Loaded }>();

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

/** The edition of whoever is signed in, when there is a request to read it from. Anything else gets Both Hands. */
async function currentEdition(): Promise<string> {
  try {
    const { getCurrentUser } = await import("@/lib/auth");
    return (await getCurrentUser())?.edition ?? "BOTH_HANDS";
  } catch {
    return "BOTH_HANDS"; // no request (a script or a test)
  }
}

/**
 * Loads the licensed content pack. Order: local files (development), then the
 * database (production, uploaded at /setup), then the public draft fallback.
 * People in The Road to Renewal get that book (pack-renewal) once it's installed; until then, Both Hands.
 */
export async function getContent(edition?: string): Promise<Loaded> {
  const ed = edition ?? (await currentEdition());
  const stamp = await dbStamp();
  const hit = cached.get(ed);
  if (hit && hit.stamp === stamp) return hit.value;
  const renewal = ed === "RENEWAL" ? (readFile<ContentPack>("pack-renewal.json") ?? (await readDb<ContentPack>("pack-renewal"))) : null;
  const pack = renewal ?? readFile<ContentPack>("pack.json") ?? (await readDb<ContentPack>("pack"));
  const entrepreneur = readFile<EntrepreneurPack>("entrepreneur.json") ?? (await readDb<EntrepreneurPack>("entrepreneur"));
  // Ed's name and Ed's mentor are cleaned out of the book's text as it loads (the author's request).
  const cleaned = cleanPack(pack ?? publicPack);
  // The book's stories, rewritten to stand on their own, replace Ed's Lessons and Jay's Journey when installed.
  const ex = (await getForgeSource())?.exercises ?? [];
  const lessons = ex.find((g) => /lessons/i.test(g.group))?.items;
  const questions = ex.find((g) => /questions/i.test(g.group))?.items;
  if (lessons?.length) cleaned.edsLessons = lessons.map((x) => ({ chapter: x.theme, title: x.title, setup: x.setup, prompts: x.prompts }));
  if (questions?.length) cleaned.jaysJourney = questions.map((x) => ({ title: x.title, setup: x.setup, prompts: x.prompts }));
  const value = { pack: cleaned, entrepreneur: entrepreneur ? cleanEntrepreneur(entrepreneur) : entrepreneur };
  cached.set(ed, { stamp, value });
  return value;
}

export function clearContentCache() {
  cached.clear();
}

export async function pillar(key: PillarKey) {
  return (await getContent()).pack.pillars.find((p) => p.key === key)!;
}
