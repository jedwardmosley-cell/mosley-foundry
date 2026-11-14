import { requireUser } from "@/lib/auth";
import { PageHeader, Draft } from "@/components/ui";
import { reviewSets, type ReviewSet } from "@/content/review";
import { getForgeSource } from "@/content/forgeSource";

export const metadata = { title: "Content review" };

/** The author's view of every draft wording set. Clients never see Draft marks. */
export default async function ContentReview() {
  await requireUser("ADMIN");
  const src = await getForgeSource();
  // The FORGE teaching cards come from forge-source.md, which is uploaded privately at /setup.
  const forgeSet: ReviewSet = {
    key: "forge", title: "FORGE teaching cards", where: "Who's behind the wheel, What this means, and the full guides", file: "forge-source.md (uploaded at /setup)", draft: src?.draft ?? true,
    groups: src
      ? (["F", "O", "R", "G", "E"] as const).filter((k) => src.cards[k]).map((k) => {
          const c = src.cards[k]!;
          return { label: `${k} · ${c.rule}`, items: [c.means, `From the road: ${c.road} ${c.roadMore}`.trim(), `Why it works: ${c.why} ${c.whyMore}`.trim(), `Sources: ${c.sources}`, `How it connects: ${c.connects}`, `Before you write: ${[c.beforeIntro, ...c.before].filter(Boolean).join(" ")}`] };
        })
      : [{ label: "Not installed", items: ["Upload forge-source.md at /setup to see the cards here."] }],
  };
  const bookSet: ReviewSet = {
    key: "forgebook", title: "FORGE opening and the book's sources", where: "Who's behind the wheel, the five parts of one driver", file: "forge-source.md (uploaded at /setup)", draft: src?.draft ?? true,
    groups: src ? [
      { label: "Core idea", items: [src.intro.line, src.intro.core] },
      { label: "The forge", items: [src.intro.forge] },
      { label: "FORGE at a Glance", items: [src.intro.glance] },
      ...src.bookSources.map((g) => ({ label: `Selected sources: ${g.group}`, items: g.items })),
    ] : [{ label: "Not installed", items: ["Upload forge-source.md at /setup to see it here."] }],
  };
  const sets = [bookSet, forgeSet, ...reviewSets()];
  const drafts = sets.filter((s) => s.draft);
  return (
    <>
      <PageHeader eyebrow="Administration" title="Content review">
        Wording you have not approved yet. Clients see it without any Draft mark. Tell the build team which sets you approve, or what to change.
      </PageHeader>
      <p className="mb-6 text-sm text-ink-soft">{drafts.length} of {sets.length} sets are still drafts.</p>
      <div className="space-y-3">
        {sets.map((s) => (
          <details key={s.key} className="card !py-4">
            <summary className="cursor-pointer list-none flex items-center gap-3">
              <span className="flex-1">
                <span className="block h3">{s.title}</span>
                <span className="block text-sm text-ink-mute">{s.where}</span>
              </span>
              {s.draft ? <Draft>Draft</Draft> : <span className="chip">Approved</span>}
            </summary>
            <div className="mt-4 space-y-4">
              {s.groups.map((g) => (
                <div key={g.label}>
                  <p className="text-sm font-medium text-heading">{g.label}</p>
                  <ul className="mt-1.5 space-y-1 text-[15px] text-ink-soft">
                    {g.items.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-ink-mute">Lives in {s.file}</p>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
