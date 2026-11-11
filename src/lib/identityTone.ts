import type { IdentityLevel } from "@/content/identity";

/** How the AI Companion's tone is chosen. Pure functions, so they can be tested without the AI. */
export type Tone = "SUPPORTIVE" | "DIRECT" | "DEMANDING";
export type ToneSetting = "AUTO" | Tone;

const BY_LEVEL: Record<IdentityLevel, Tone> = { CORE: "SUPPORTIVE", ROLE: "DIRECT", REINVENT: "DEMANDING" };

/** The participant's own choice wins. "AUTO" follows their identity level. No identity profile means no tone change. */
export function effectiveTone(id: { level: string; tone: string } | null | undefined): Tone | null {
  if (!id) return null;
  if (id.tone === "SUPPORTIVE" || id.tone === "DIRECT" || id.tone === "DEMANDING") return id.tone;
  return BY_LEVEL[id.level as IdentityLevel] ?? null;
}

const VOICE: Record<Tone, string> = {
  SUPPORTIVE: "Coaching tone for this participant: supportive, reflective, curious and encouraging. Keep the focus on small, repeatable behaviors.",
  DIRECT: "Coaching tone for this participant: practical, direct, action-oriented and appropriately challenging. Keep the focus on real decisions and behaviors in their role.",
  DEMANDING: "Coaching tone for this participant: focused, demanding, performance-oriented and disciplined. You may challenge excuses, point out gaps between what they said and what they did, and ask for concrete evidence of action. Keep the focus on preparation, rehearsal, action and accountability.",
};

/** Fixed limits that apply at every tone. A more demanding tone means more deliberate practice, never harsher language. */
export const TONE_LIMITS = [
  "Limits that apply at every tone:",
  "- Never insult the participant, mock them, or question their worth. Never encourage self-punishment or anything harmful.",
  "- Never present psychological speculation as established science.",
  "- A performance identity is a practice tool the participant chose to prepare for demanding situations. Treat it as a way to prepare. It is still them, and it is never a separate personality.",
  "- The identity level is the participant's own choice. Never assign a level, never suggest one level is better than another, and never tie it to their FORGE scores.",
  "- A bigger shift calls for more deliberate preparation, practice and accountability. It does not call for more aggressive language.",
].join("\n");

export function toneBlock(tone: Tone | null): string {
  return tone ? `${VOICE[tone]}\n${TONE_LIMITS}` : "";
}

export const TONE_LABELS: Record<ToneSetting, string> = {
  AUTO: "Match my level",
  SUPPORTIVE: "Supportive and reflective",
  DIRECT: "Practical and direct",
  DEMANDING: "Focused and demanding",
};
