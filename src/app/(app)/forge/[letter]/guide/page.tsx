import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getForgeSource } from "@/content/forgeSource";
import { FORGE_LINES } from "@/content/forgeLines";
import { BOOK } from "@/content/book";
import type { PillarKey } from "@/content/types";
import { PillarMark } from "@/components/ui";

export const metadata = { title: "FORGE guide" };

/**
 * The full guide for one rule: the Chapter 9 section, why it works with its sources,
 * how it connects, and the Road Test. It ends by pointing to the book.
 */
export default async function ForgeGuide({ params }: { params: Promise<{ letter: string }> }) {
  await requireUser("PARTICIPANT", "COACH", "ADMIN");
  const { letter } = await params;
  const key = letter.toUpperCase() as PillarKey;
  const line = FORGE_LINES.find((l) => l.pillar === key);
  if (!line) notFound();
  const src = await getForgeSource();
  const card = src?.cards[key];
  const chapter = src?.chapter[key];
  return (
    <article className="max-w-2xl">
      <Link href={`/forge/${key.toLowerCase()}`} className="text-sm btn-link">Back to {key}</Link>
      <header className="mt-6">
        <PillarMark k={key} size="lg" />
        <p className="mt-4 section-label">The full guide</p>
        <h1 className="mt-2 h1">{line.label}</h1>
        {card?.rule && <p className="mt-2 font-serif text-[22px] text-ink-soft">{card.rule}</p>}
      </header>

      {chapter && (
        <section className="mt-10">
          <h2 className="section-label">From Chapter 9, The Rules of the Road</h2>
          <div className="mt-3 space-y-4 font-serif text-[18px] leading-[1.6] text-heading">
            {chapter.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </section>
      )}

      {card && (
        <>
          <section id="why" className="mt-10 scroll-mt-20">
            <h2 className="section-label">Why it works</h2>
            <p className="mt-2 text-[16px] leading-relaxed">{card.why}</p>
            {card.whyMore && <p className="mt-3 text-[16px] leading-relaxed">{card.whyMore}</p>}
            <p className="mt-2 text-sm text-ink-mute">{card.sources}</p>
          </section>
          <section className="mt-10">
            <h2 className="section-label">How it connects</h2>
            <p className="mt-2 text-[16px] leading-relaxed">{card.connects}</p>
          </section>
          {card.roadTest && (
            <section className="mt-10 rounded-[22px] bg-ink/[0.04] px-5 py-5">
              <h2 className="section-label">Road test</h2>
              <p className="mt-2 text-[16px] leading-relaxed">{card.roadTest}</p>
            </section>
          )}
        </>
      )}

      <p className="mt-12 border-t border-line/60 pt-6 text-[15px] text-ink-soft">
        The full story is in <a href={BOOK.url} target="_blank" rel="noopener noreferrer" className="btn-link">Both Hands on the Wheel</a>.
      </p>
    </article>
  );
}
