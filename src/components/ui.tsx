import Link from "next/link";
import type { ReactNode } from "react";
import type { PillarKey } from "@/content/types";

/** `plain` is the one-line, plain-words meaning of a section name from the book, shown under the title. */
export function PageHeader({ eyebrow, title, plain, children }: { eyebrow?: string; title: string; plain?: string; children?: ReactNode }) {
  return (
    <header className="mb-7 sm:mb-10">
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <h1 className="h1">{title}</h1>
      {plain && <p className="mt-2 font-book italic text-[19px] text-ink-soft">{plain}</p>}
      {children && <div className="mt-4 muted text-[16px] leading-relaxed max-w-xl">{children}</div>}
    </header>
  );
}

/**
 * A chapter opening, set like the first page of a chapter in the book: the running head, an optional line above
 * the photo (a day or a week), the chapter's photograph, the title in capitals, its plain line in italics, then
 * the intro. No chapter numbers on screen.
 */
export function ChapterOpening({ title, plain, image, alt, kicker, children }: { title: string; plain?: string; image: string; alt: string; kicker?: string; children?: ReactNode }) {
  return (
    <header className="mb-8 sm:mb-10">
      <p className="text-center text-[12px] text-ink-mute">both hands on the wheel</p>
      {kicker && <p className="mt-4 font-book text-[24px] leading-none text-heading">{kicker}</p>}
      <div className="mt-4 -mx-4 sm:mx-0 aspect-[16/9] bg-ink/10 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} role="img" aria-label={alt} />
      <h1 className="mt-5 font-book text-[30px] sm:text-[36px] leading-[1.05] uppercase tracking-[0.01em] text-heading text-balance">{title}</h1>
      {plain && <p className="mt-2 font-book italic text-[19px] text-ink-soft">{plain}</p>}
      {children && <div className="mt-4 text-[16px] leading-relaxed text-ink-soft max-w-xl">{children}</div>}
    </header>
  );
}

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`card ${className}`}>{children}</section>;
}

const PILLAR_TONE: Record<PillarKey, string> = {
  F: "bg-fblue text-white",
  O: "bg-sage text-white",
  R: "bg-brass text-white",
  G: "bg-violet text-white",
  E: "bg-clay text-white",
};

/** Pillar colors, used only for pillar things: marks, practice squares and the 30-day arc. */
export const PILLAR_FILL: Record<PillarKey, { full: string; part: string; cssVar: string }> = {
  F: { full: "bg-fblue", part: "bg-fblue/40", cssVar: "--fblue" },
  O: { full: "bg-sage", part: "bg-sage/40", cssVar: "--sage" },
  R: { full: "bg-brass", part: "bg-brass/40", cssVar: "--brass" },
  G: { full: "bg-violet", part: "bg-violet/40", cssVar: "--violet" },
  E: { full: "bg-clay", part: "bg-clay/40", cssVar: "--clay" },
};

export function PillarMark({ k, size = "md" }: { k: PillarKey; size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "h-6 w-6 text-xs" : size === "lg" ? "h-11 w-11 text-lg" : "h-8 w-8 text-sm";
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full font-sans font-extrabold ${s} ${PILLAR_TONE[k]}`}>
      {k}
    </span>
  );
}

/** A quiet five-step gauge. Not a progress bar to fill: a reading of where you are. */
export function Gauge({ value, max = 5, label }: { value: number; max?: number; label: string }) {
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`${label}: ${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`h-1.5 w-6 rounded-full ${i < value ? "bg-navy" : "bg-ink/[0.08]"}`} />
      ))}
    </div>
  );
}

export function Source({ children }: { children: ReactNode }) {
  return <p className="source mt-3">Source: {children}</p>;
}

export function Draft({ children = "Draft for author review" }: { children?: ReactNode }) {
  return <span className="draft">{children}</span>;
}

export function Empty({ title, children, href, cta }: { title: string; children?: ReactNode; href?: string; cta?: string }) {
  return (
    <div className="rounded-[24px] bg-ink/[0.03] border border-dashed border-ink/15 p-8 text-center">
      <p className="h3">{title}</p>
      {children && <p className="muted mt-1 text-sm">{children}</p>}
      {href && cta && (
        <Link href={href} className="btn-primary mt-4">
          {cta}
        </Link>
      )}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-mute">{hint}</span>}
    </label>
  );
}

export function Privacy({ shared }: { shared: boolean }) {
  return shared ? (
    <span className="chip text-link">Shared with coach</span>
  ) : (
    <span className="chip">Private</span>
  );
}
