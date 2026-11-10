import "server-only";
import { getContent } from "@/content";
import { SEGMENTS } from "@/content/program";

/** Resolves a stable exercise reference to its approved text. */
export async function exerciseText(ref: string): Promise<{ title: string; text: string } | null> {
  const { pack } = await getContent();
  const [kind, a] = ref.split(":");
  if (kind === "ed") { const e = pack.edsLessons[Number(a)]; return e ? { title: `Ed's Lessons: ${e.title}`, text: [e.setup, ...e.prompts].filter(Boolean).join("\n\n") } : null; }
  if (kind === "jay") { const j = pack.jaysJourney[Number(a)]; return j ? { title: `Jay's Journey: ${j.title}`, text: [j.setup, ...j.prompts].filter(Boolean).join("\n\n") } : null; }
  if (kind === "chapter") { const c = pack.chapters.find((x) => x.number === Number(a)); return c ? { title: `Road Test: ${c.title}`, text: c.roadTest.join("\n\n") } : null; }
  if (kind === "segment") { const s = SEGMENTS.find((x) => x.key === a); return s ? { title: `Segment ${s.key} practice: ${s.title}`, text: s.practice.text } : null; }
  return null;
}
