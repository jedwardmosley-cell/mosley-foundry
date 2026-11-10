import "server-only";
import fs from "node:fs";
import path from "node:path";
import { publicPack } from "./public-pack";
import type { ContentPack, EntrepreneurPack, PillarKey } from "./types";

let cached: { pack: ContentPack; entrepreneur: EntrepreneurPack | null } | null = null;

function readJson<T>(file: string): T | null {
  const p = path.join(process.cwd(), "src", "content", "licensed", file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

/** Loads the licensed pack if installed, otherwise the public fallback. Server-side only. */
export function getContent() {
  if (cached && process.env.NODE_ENV === "production") return cached;
  const licensed = readJson<ContentPack>("pack.json");
  const entrepreneur = readJson<EntrepreneurPack>("entrepreneur.json");
  cached = { pack: licensed ?? publicPack, entrepreneur };
  return cached;
}

export function pillar(key: PillarKey) {
  return getContent().pack.pillars.find((p) => p.key === key)!;
}

/** Stable reference strings used for citations in the UI and the AI companion. */
export const ref = {
  workbook: (section: string) => `Personal Application Workbook, ${section}`,
  chapter: (n: number, title: string, part?: string) => `Both Hands on the Wheel, Ch. ${n} ${title}${part ? `, ${part}` : ""}`,
};
