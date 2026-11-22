/**
 * Editions: the same app built on a different book. Both Hands on the Wheel is the default.
 * The Road to Renewal opens with an access code. Everything works the same; the name, the look and the book change.
 */
export const EDITIONS = {
  BOTH_HANDS: { key: "BOTH_HANDS", name: "Both Hands on the Wheel", tagline: "Mosley Foundry", className: "" },
  RENEWAL: { key: "RENEWAL", name: "The Road to Renewal", tagline: "Faith, Discipline, and the Journey to Lasting Change", className: "edition-renewal" },
} as const;
export type EditionKey = keyof typeof EDITIONS;

export function editionOf(key: string | null | undefined) {
  return EDITIONS[(key && key in EDITIONS ? key : "BOTH_HANDS") as EditionKey];
}

/** Codes are typed by hand, so case, spaces and dashes don't matter. */
export function normalizeCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

type CodeRow = { active: boolean; expiresAt: Date | null; maxUses: number | null; uses: number };
/** Why a code can't be used right now, or null when it can. */
export function codeProblem(c: CodeRow | null, now = new Date()): "unknown" | "off" | "expired" | "full" | null {
  if (!c) return "unknown";
  if (!c.active) return "off";
  if (c.expiresAt && c.expiresAt < now) return "expired";
  if (c.maxUses != null && c.uses >= c.maxUses) return "full";
  return null;
}
