import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { consoleExercise } from "@/lib/tone";
import { NAMES } from "@/content/names";
import { THREE_CS, THREE_C_KEYS } from "@/content/threeCs";
import { keepToneLine, removeToneLine } from "@/app/actions/tone";
import { ChapterOpening, Card } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { InTheBook } from "@/components/InTheBook";
import { Fold } from "@/components/Fold";

export const metadata = { title: "The Glove Box" };

/**
 * The Glove Box: the client's own collection of power statements, kept within reach.
 * Sorted by the three Cs. Lines come from Set the Tone or are added here. Private.
 */
export default async function GloveBoxPage({ searchParams }: { searchParams: Promise<{ kept?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const sp = await searchParams;
  const [lines, { pack }] = await Promise.all([
    db.toneLine.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
    getContent(),
  ]);
  // One statement for today, a different one each day, so the collection gets read and not just stored.
  const day = Math.floor(Date.now() / 864e5);
  const today = lines.length ? lines[day % lines.length] : null;

  return (
    <>
      <ChapterOpening image="/chapters/glove-box.jpg" alt="An open glove box: a notebook and pen, a Bible, a map and sunglasses" title={NAMES.glovebox.name} plain={NAMES.glovebox.plain}>
        <Fold lead="Lines worth keeping: something you read, something someone said to you, or a rewrite from Set the Tone that landed." rest="Pull one out before a moment that matters, so your words are already set when you get there." />
      </ChapterOpening>

      {sp.kept && <p role="status" className="notice mb-5">In your Glove Box.</p>}

      {today && (
        <section className="mb-8 border-l-4 border-lane pl-5" aria-label="For today">
          <p className="section-label">For today</p>
          <p className="mt-2 font-serif text-[22px] leading-snug text-heading">{today.text}</p>
          <p className="mt-1 text-sm text-ink-mute">{THREE_CS[today.kind as keyof typeof THREE_CS]?.name ?? ""}. Read it out loud once.</p>
        </section>
      )}

      <h2 className="h2">The three Cs</h2>
      <p className="mt-1 text-[15px] text-ink-soft">Test a statement before you keep it. A good one does at least one of three things: it claims, it confirms or it condemns.</p>
      <InTheBook lines={consoleExercise(pack.chapters, "catalog")} />

      <div className="mt-4 space-y-3">
        {THREE_C_KEYS.map((k) => {
          const mine = lines.filter((l) => l.kind === k);
          return (
            // Each C folds on its own. Short lists start open; a long one starts folded, showing its count.
            <details key={k} id={`c-${k.toLowerCase()}`} open={mine.length > 0 && mine.length <= 3} className="card group">
              <summary className="flex cursor-pointer items-baseline gap-3">
                <span className="flex-1">
                  <span className="font-book text-[21px] text-heading">{THREE_CS[k].name}</span>
                  <span className="block text-[14px] text-ink-soft">{THREE_CS[k].line}</span>
                </span>
                <span className="shrink-0 text-[14px] text-ink-mute">{mine.length === 0 ? "None yet" : `${mine.length} ${mine.length === 1 ? "statement" : "statements"}`}</span>
              </summary>
              {mine.length === 0
                ? <p className="mt-2 text-sm text-ink-mute">For example: <span className="italic">&ldquo;{THREE_CS[k].example}&rdquo;</span></p>
                : (
                  <ul className="mt-2 divide-y divide-line/60">
                    {mine.map((l) => (
                      <li key={l.id} className="flex items-start justify-between gap-3 py-2">
                        <span className="font-book text-[18px] leading-snug text-heading">{l.text}</span>
                        <form action={removeToneLine}><input type="hidden" name="id" value={l.id} /><button className="text-xs text-ink-mute hover:text-alert" aria-label={`Remove ${l.text}`}>Remove</button></form>
                      </li>
                    ))}
                  </ul>
                )}
            </details>
          );
        })}
        <Card>
          <h3 className="h3">Add a statement</h3>
          <form action={keepToneLine} className="mt-3 space-y-3">
            <input type="hidden" name="back" value="glovebox" />
            <input name="line" required maxLength={300} className="input" aria-label="Your statement" placeholder="Something you read, heard or told yourself that's worth keeping" />
            <div className="flex flex-wrap items-center gap-3">
              <select name="kind" defaultValue="CONFIRM" className="input !w-auto" aria-label="Which C">
                {THREE_C_KEYS.map((k) => <option key={k} value={k}>{THREE_CS[k].name}</option>)}
              </select>
              <Submit className="btn-primary">Put it in the Glove Box</Submit>
            </div>
          </form>
        </Card>
      </div>

      <p className="mt-8 text-sm text-ink-mute">Private. Only you see your Glove Box. <Link href="/tone" className="btn-link">Back to Set the Tone</Link></p>
    </>
  );
}
