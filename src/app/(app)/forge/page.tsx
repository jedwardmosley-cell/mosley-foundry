import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getForgeSource } from "@/content/forgeSource";
import { FORGE_LINES } from "@/content/forgeLines";
import { PillarMark } from "@/components/ui";

export const metadata = { title: "FORGE" };

/** The whole framework, shown once before F. Words from forge-source.md. */
export default async function ForgeIntro() {
  await requireUser("PARTICIPANT");
  const src = await getForgeSource();
  return (
    <article className="flex min-h-[70vh] flex-col justify-center">
      <p className="section-label">FORGE</p>
      <h1 className="mt-4 font-serif text-[34px] sm:text-[46px] leading-[1.12] tracking-[-0.02em] text-heading">{src?.intro.line || "Five parts of one driver."}</h1>
      {src?.intro.forge && <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-soft">{src.intro.forge}</p>}
      <ul className="mt-10 grid grid-cols-5 gap-2 sm:max-w-lg">
        {FORGE_LINES.map((l) => (
          <li key={l.pillar} className="flex flex-col items-center gap-2 text-center">
            <PillarMark k={l.pillar} />
            <span className="text-[11px] leading-tight text-ink-soft">{l.label}</span>
          </li>
        ))}
      </ul>
      {src?.intro.parts && <p className="mt-6 text-[15px] text-ink-soft">{src.intro.parts}</p>}
      <Link href="/forge/f" className="btn-primary mt-10 self-start">Start with F</Link>
    </article>
  );
}
