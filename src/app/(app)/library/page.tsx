import { requireUser } from "@/lib/auth";
import { getContent } from "@/content";
import { PageHeader, Card, PillarMark, Source, Empty } from "@/components/ui";

export const metadata = { title: "Road library" };

export default async function LibraryPage() {
  await requireUser();
  const { pack } = await getContent();
  if (pack.kind !== "licensed") {
    return (
      <>
        <PageHeader title="Road library" />
        <Empty title="Content pack not installed">Book passages and workbook exercises appear here once the licensed content pack is installed on this server.</Empty>
      </>
    );
  }
  return (
    <>
      <PageHeader eyebrow="Both Hands on the Wheel" title="Road library">
        Reflection prompts, road tests and exercises from the book and the Personal Application Workbook. Pick one that hits close and do it this week.
      </PageHeader>

      <h2 className="h2 mb-3">The Rules of the Road</h2>
      <div className="space-y-3">
        {pack.pillars.map((p) => p.rule && (
          <details key={p.key} className="card">
            <summary className="cursor-pointer flex items-center gap-3"><PillarMark k={p.key} size="sm" /><span className="font-medium">{p.rule.heading.replace(/^Rule \d: /, "")}</span></summary>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed">{p.rule.paragraphs.map((t) => <p key={t}>{t}</p>)}</div>
            <Source>Both Hands on the Wheel, Ch. 9 The Rules of the Road</Source>
          </details>
        ))}
      </div>

      <h2 className="h2 mt-10 mb-3">Chapters</h2>
      <div className="space-y-3">
        {pack.chapters.map((c) => (
          <details key={c.number} className="card">
            <summary className="cursor-pointer"><span className="text-ink-mute mr-2">{c.number}</span><span className="font-medium">{c.title}</span><span className="muted"> · {c.subtitle}</span></summary>
            {c.lessons.length > 0 && <ul className="mt-3 text-sm text-ink-soft space-y-0.5">{c.lessons.map((l) => <li key={l}>{l}</li>)}</ul>}
            {(["refuel", "reflect", "roadTest"] as const).map((k) => c[k].length > 0 && (
              <div key={k} className="mt-4">
                <p className="eyebrow">{k === "roadTest" ? "Road test" : k === "refuel" ? "Refuel" : "Reflect"}</p>
                <p className="mt-1 text-sm text-ink-soft">{c[k][0]}</p>
                <ul className="mt-2 space-y-2 list-disc pl-5 text-[15px]">{c[k].slice(1).map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            ))}
            <Source>Both Hands on the Wheel, Ch. {c.number} {c.title}</Source>
          </details>
        ))}
      </div>

      <h2 className="h2 mt-10 mb-1">Ed&apos;s Lessons</h2>
      <p className="muted mb-3 text-[15px]">Key moments from the book, two layers deep.</p>
      <div className="space-y-3">
        {pack.edsLessons.map((e) => (
          <Card key={e.title}>
            <p className="eyebrow">From {e.chapter}</p>
            <h3 className="h3 mt-1">{e.title}</h3>
            {e.quote && <p className="quote mt-3">{e.quote}</p>}
            {e.setup && <p className="mt-3 text-[15px] leading-relaxed">{e.setup}</p>}
            <ul className="mt-3 space-y-2 text-[15px]">{e.prompts.map((t) => <li key={t}>{t}</li>)}</ul>
            <Source>Personal Application Workbook, Section Four</Source>
          </Card>
        ))}
      </div>

      <h2 className="h2 mt-10 mb-1">Jay&apos;s Journey</h2>
      <p className="muted mb-3 text-[15px]">The questions Jay was never asked until that car ride.</p>
      <div className="space-y-3">
        {pack.jaysJourney.map((j) => (
          <Card key={j.title}>
            <h3 className="h3">{j.title}</h3>
            {j.setup && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{j.setup}</p>}
            <ul className="mt-3 space-y-2 text-[15px]">{j.prompts.map((t) => <li key={t}>{t}</li>)}</ul>
            <Source>Personal Application Workbook, Section Five</Source>
          </Card>
        ))}
      </div>
    </>
  );
}
