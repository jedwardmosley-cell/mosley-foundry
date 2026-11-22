import { getContent } from "@/content";

/**
 * The Road to Renewal: the chapter's Faith Check-In, its verse and its prayer, at the end of the matching section.
 * Shows nothing in Both Hands on the Wheel, or until the Renewal book is installed.
 */
export async function FaithCheckIn({ chapter, className = "mt-10" }: { chapter: RegExp; className?: string }) {
  const { pack } = await getContent();
  const k = pack.chapters.find((c) => chapter.test(c.title))?.faithCheckIn;
  if (!k?.verse) return null;
  return (
    <section aria-label="Faith Check-In" className={`border-t border-line/70 pt-6 ${className}`}>
      <p className="section-label">Faith Check-In</p>
      <blockquote className="mt-3 border-l-4 border-lane pl-4">
        <p className="font-book text-[20px] leading-snug text-heading">&ldquo;{k.verse}&rdquo;</p>
        {k.reference && <p className="mt-1 text-sm text-ink-mute">{k.reference}</p>}
      </blockquote>
      {k.prayer.length > 0 && (
        <details className="group/pray mt-4">
          <summary className="cursor-pointer list-none text-[15px] font-medium text-link">
            <span className="group-open/pray:hidden">Pray it</span><span className="hidden group-open/pray:inline">Close the prayer</span>
          </summary>
          <div className="mt-3 space-y-0.5 font-book text-[18px] italic leading-relaxed text-ink">{k.prayer.map((l, i) => <p key={i}>{l}</p>)}</div>
        </details>
      )}
    </section>
  );
}

/** The Road to Renewal, chapter 9: the Ten Pathways of Promise, each beside its Detour of Destruction. */
export async function TenPathways() {
  const { pack } = await getContent();
  const ch = pack.chapters.find((c) => /rules of the road/i.test(c.title));
  if (!ch?.pathways?.length) return null;
  return (
    <details id="pathways" className="group/paths mt-10 border-t border-line/70 pt-6">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
        <span>
          <span className="block font-book text-[23px] leading-tight text-heading">The Ten Pathways of Promise</span>
          {ch.subtitle && !/pathways/i.test(ch.subtitle) && <span className="mt-0.5 block font-book italic text-[16px] text-ink-soft">{ch.subtitle}</span>}
          <span className="mt-1 block text-[14px] text-ink-soft group-open/paths:hidden">Each pathway, and the detour that pulls you off it</span>
        </span>
        <span aria-hidden className="mt-2 h-2.5 w-2.5 shrink-0 rotate-45 border-b-[1.6px] border-r-[1.6px] border-ink-mute transition group-open/paths:-rotate-[135deg]" />
      </summary>
      <ol className="mt-4 divide-y divide-line/60">
        {ch.pathways.map((p) => (
          <li key={p.number} className="grid grid-cols-[2rem_1fr] gap-2 py-3">
            <span className="font-book text-[18px] text-ink-mute">{p.number}</span>
            <span>
              <span className="block font-book text-[19px] text-heading">{p.name}</span>
              {p.detour && <span className="block text-sm text-ink-soft">Detour: {p.detour}</span>}
            </span>
          </li>
        ))}
      </ol>
      {ch.reflect.length > 0 && (
        <div className="mt-4">
          <p className="section-label">Reflect</p>
          <ul className="mt-2 space-y-2 text-[15px] text-ink">{ch.reflect.map((q) => <li key={q}>{q}</li>)}</ul>
        </div>
      )}
    </details>
  );
}
