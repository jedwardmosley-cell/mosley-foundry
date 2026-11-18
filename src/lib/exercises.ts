import "server-only";
import { getContent } from "@/content";
import { SEGMENTS } from "@/content/program";
import { IDENTITY_EXERCISES } from "@/content/identity";

/** Resolves a stable exercise reference to its approved text. */
export async function exerciseText(ref: string): Promise<{ title: string; text: string } | null> {
  const { pack } = await getContent();
  const [kind, a] = ref.split(":");
  if (kind === "ed") { const e = pack.edsLessons[Number(a)]; return e ? { title: `Lessons from the road: ${e.title}`, text: [e.setup, ...e.prompts].filter(Boolean).join("\n\n") } : null; }
  if (kind === "jay") { const j = pack.jaysJourney[Number(a)]; return j ? { title: `Questions for the road: ${j.title}`, text: [j.setup, ...j.prompts].filter(Boolean).join("\n\n") } : null; }
  if (kind === "chapter") { const c = pack.chapters.find((x) => x.number === Number(a)); return c ? { title: `Road test: ${c.title}`, text: c.roadTest.join("\n\n") } : null; }
  if (kind === "identity") { const x = IDENTITY_EXERCISES[Number(a)]; return x ? { title: `Identity: ${x.title}`, text: x.text } : null; }
  if (kind === "segment") { const s = SEGMENTS.find((x) => x.key === a); return s ? { title: `Segment ${s.key} practice: ${s.title}`, text: s.practice.text } : null; }
  return null;
}

/** Every program exercise a coach can assign, by stable reference. Used by the assign form and session prep. */
export function exerciseMenu(pack: Awaited<ReturnType<typeof getContent>>["pack"]): { ref: string; title: string; text: string }[] {
  return [
    ...pack.edsLessons.map((e, i) => ({ ref: `ed:${i}`, title: `Lessons from the road: ${e.title}`, text: [e.setup, ...e.prompts].filter(Boolean).join("\n\n") })),
    ...pack.jaysJourney.map((j, i) => ({ ref: `jay:${i}`, title: `Questions for the road: ${j.title}`, text: [j.setup, ...j.prompts].filter(Boolean).join("\n\n") })),
    ...pack.chapters.filter((c) => c.roadTest.length).map((c) => ({ ref: `chapter:${c.number}:roadTest`, title: `Road Test: ${c.title}`, text: c.roadTest.join("\n\n") })),
    ...SEGMENTS.map((x) => ({ ref: `segment:${x.key}`, title: `Segment ${x.key} practice: ${x.title}`, text: x.practice.text })),
    ...IDENTITY_EXERCISES.map((x, i) => ({ ref: `identity:${i}`, title: `Identity: ${x.title}`, text: x.text })),
  ];
}
