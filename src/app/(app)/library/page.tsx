import Link from "next/link";
import type { CSSProperties } from "react";
import { requireUser } from "@/lib/auth";
import { getForgeSource } from "@/content/forgeSource";
import { FORGE_LINES } from "@/content/forgeLines";
import { BOOK } from "@/content/book";
import type { PillarKey } from "@/content/types";
import { PageHeader, Empty, PillarMark, PILLAR_FILL } from "@/components/ui";
import { GuideText } from "@/components/GuideText";

export const metadata = { title: "Library" };

/** The Library is the author's teaching guide, The FORGE Framework: Five Rules for the Road. */
export default async function LibraryPage() {
  await requireUser();
  const g = (await getForgeSource())?.guide;
  if (!g) {
    return (
      <>
        <PageHeader eyebrow="Library" title="The FORGE Framework" />
        <Empty title="The guide isn't installed yet">It appears here once forge-source.md is uploaded at /setup.</Empty>
      </>
    );
  }
  const ORDER: PillarKey[] = ["F", "O", "R", "G", "E"];
  return (
    <article className="max-w-2xl">
      <PageHeader eyebrow="Library" title={g.title} />

      {g.intro.map((s) => (
        <section key={s.heading} className="mb-10">
          <h2 className="h2 mb-4">{s.heading}</h2>
          <GuideText md={s.md} />
        </section>
      ))}

      <div className="space-y-6">
        {ORDER.filter((k) => g.rules[k]).map((k) => {
          const r = g.rules[k]!;
          const line = FORGE_LINES.find((l) => l.pillar === k)!;
          const rule = r.heading.replace(/^[FORGE]:\s*[^.]+\.\s*/, "");
          const tone = { "--pc": `var(${PILLAR_FILL[k].cssVar})` } as CSSProperties;
          return (
            <section key={k} id={k.toLowerCase()} style={tone} className="card scroll-mt-20">
              <header className="flex items-start gap-3.5">
                <PillarMark k={k} />
                <div>
                  <h2 className="font-serif text-[24px] leading-tight text-heading">{line.label}</h2>
                  <p className="mt-0.5 font-serif text-[18px] italic" style={{ color: "rgb(var(--pc))" }}>{rule}</p>
                </div>
              </header>
              <GuideText md={r.md} className="mt-5" />
              {r.practice && (
                <div className="mt-5 rounded-2xl px-4 py-3.5" style={{ background: "rgb(var(--pc) / 0.07)" }}>
                  <p className="section-label" style={{ color: "rgb(var(--pc))" }}>In practice</p>
                  <p className="mt-1.5 text-[16px] leading-relaxed">{r.practice[0].toUpperCase() + r.practice.slice(1)}</p>
                </div>
              )}
              <Link href={`/forge/${k.toLowerCase()}/guide`} className="mt-4 inline-block text-sm btn-link">Read the full guide, with the research</Link>
            </section>
          );
        })}
      </div>

      {g.outro.map((s) => (
        <section key={s.heading} className="mt-10">
          <h2 className="h2 mb-4">{s.heading}</h2>
          <GuideText md={s.md} />
        </section>
      ))}

      <p className="mt-12 border-t border-line/60 pt-6 text-[15px] text-ink-soft">
        The full story behind each rule is in <a href={BOOK.url} target="_blank" rel="noopener noreferrer" className="btn-link">Both Hands on the Wheel</a>.
      </p>
    </article>
  );
}
