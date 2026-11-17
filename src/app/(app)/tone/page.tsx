import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmt, addDays, ymd } from "@/lib/dates";
import { findClosedDoors, tally, bookQuestions, type DoorHit } from "@/lib/tone";
import { getContent } from "@/content";
import type { ToneReading } from "@/lib/ai";
import { readSelfTalk, keepToneLine, removeToneLine, deleteToneEntry, setToneReadsWriting } from "@/app/actions/tone";
import { PageHeader, Card, PillarMark } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { DictationHint } from "@/components/Picks";
import { FORGE_LINES } from "@/content/forgeLines";
import type { PillarKey } from "@/content/types";

export const metadata = { title: "Set the Tone" };

const THREE_CS = {
  CLAIM: { name: "Claim", line: "A victory, a milestone or an outcome I'm going after" },
  CONFIRM: { name: "Confirm", line: "A belief about what I'm capable of" },
  CONDEMN: { name: "Condemn", line: "The negativity or the roadblock that would stop me" },
} as const;
type C = keyof typeof THREE_CS;

/**
 * Set the Tone: the self-talk coach. The client writes what they said to themselves, and the app reads it
 * against their own five FORGE lines. Private: nothing here is shared.
 */
export default async function TonePage({ searchParams }: { searchParams: Promise<{ entry?: string; care?: string; ai?: string; kept?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser("PARTICIPANT");
  const since = addDays(new Date(), -3);
  const [entries, lines, profile, current] = await Promise.all([
    db.toneEntry.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.toneLine.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
    db.profile.findUnique({ where: { userId: u.id }, select: { toneReadsWriting: true, destination: true, lineO: true, why: true, lineG: true, lineE: true } }),
    sp.entry ? db.toneEntry.findFirst({ where: { id: sp.entry, userId: u.id } }) : null,
  ]);

  // The three-day audit: closed-door phrases in the last three days, from here and, if the client turned it on, from what they write elsewhere.
  const recent = entries.filter((e) => e.createdAt >= since);
  const hits: DoorHit[] = recent.flatMap((e) => findClosedDoors(e.text));
  if (profile?.toneReadsWriting) {
    const [checkIns, weeks] = await Promise.all([
      db.dailyCheckIn.findMany({ where: { userId: u.id, date: { gte: ymd(since) } }, select: { note: true, reflection: true, identityNote: true } }),
      db.weeklyReflection.findMany({ where: { userId: u.id, createdAt: { gte: since } }, select: { built: true, avoided: true, nextWeek: true } }),
    ]);
    for (const c of checkIns) hits.push(...findClosedDoors([c.note, c.reflection, c.identityNote].join(" ")));
    for (const w of weeks) hits.push(...findClosedDoors([w.built, w.avoided, w.nextWeek].join(" ")));
  }
  const audit = tally(hits);
  const reading: ToneReading | null = current?.reading ? JSON.parse(current.reading) : null;
  const ruleDoors = current ? findClosedDoors(current.text) : [];
  const lineFor = (k: string) => {
    const l = FORGE_LINES.find((x) => x.pillar === k);
    return l ? (profile?.[l.field] ?? "") : "";
  };
  const hasLines = FORGE_LINES.some((l) => profile?.[l.field]?.trim());
  // The book's own self-talk questions. One a day up front; the rest a tap away.
  const { pack } = await getContent();
  const questions = bookQuestions(pack.chapters);
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const todaysQuestion = questions.length ? questions[dayOfYear % questions.length] : "";

  return (
    <>
      <PageHeader eyebrow="FORGE" title="Set the Tone">
        That defeated voice in your head isn&apos;t you. It&apos;s an imposter. Write down exactly what it said, and take it apart against who you said you are.
      </PageHeader>

      {sp.care && (
        <Card className="mb-6 border-alert/40">
          <h2 className="h3">This sounds heavy. You don&apos;t have to carry it alone.</h2>
          <p className="mt-2 text-[15px]">This isn&apos;t a moment for coaching. Please talk to someone you trust today, or to a professional.</p>
          <ul className="mt-3 space-y-1.5 text-[15px]">
            <li>In the US, call or text <a href="tel:988" className="btn-link">988</a>, the Suicide and Crisis Lifeline. It&apos;s free, any time.</li>
            <li>If you&apos;re in danger right now, call <a href="tel:911" className="btn-link">911</a> or your local emergency number.</li>
            <li>Outside the US, your local emergency number or a crisis line in your country.</li>
          </ul>
          <p className="mt-3 text-sm text-ink-soft">What you wrote is saved privately here. Nobody else sees it.</p>
        </Card>
      )}

      <Card>
        <form action={readSelfTalk} className="space-y-3">
          <label htmlFor="said" className="label">What did the imposter say?</label>
          <textarea id="said" name="said" required minLength={3} maxLength={3000} className="textarea !min-h-[110px]"
            placeholder="Word for word, the way it sounded. &quot;You can't run this meeting. They never listen to you anyway.&quot;" />
          <DictationHint />
          <div className="flex flex-wrap items-center gap-3">
            <Submit>Take it apart</Submit>
            <span className="text-sm text-ink-soft">{hasLines ? "Read against your five FORGE lines." : <>Works best once you&apos;ve written your five lines in <Link href="/identity" className="btn-link">Who&apos;s behind the wheel</Link>.</>}</span>
          </div>
        </form>
      </Card>

      {todaysQuestion && !current && !sp.care && (
        <section className="mt-6 border-l-2 border-gold/60 pl-5" aria-label="From the book">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">From the book</p>
          <p className="mt-2 font-serif text-[20px] leading-snug text-heading">{todaysQuestion}</p>
          {questions.length > 1 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-link">More questions from the book</summary>
              <ul className="mt-2 space-y-2">
                {questions.filter((q) => q !== todaysQuestion).map((q) => <li key={q} className="font-serif text-[16px] leading-snug text-ink">{q}</li>)}
              </ul>
            </details>
          )}
        </section>
      )}

      {current && !sp.care && (
        <section className="mt-6 space-y-4" aria-label="The reading">
          <Card>
            <p className="text-xs text-ink-mute">The imposter said, {fmt(current.createdAt, { weekday: "short", hour: "numeric", minute: "2-digit" })}</p>
            <p className="mt-1 font-serif text-[18px] leading-snug text-heading">&ldquo;{current.text}&rdquo;</p>
            {reading?.summary && <p className="mt-3 text-[15px]">{reading.summary}</p>}
            {sp.ai === "off" && <p className="mt-3 text-sm text-ink-soft">Help me with this is off, so this shows the defeated phrases only. Turn it on in Settings to take it apart against your FORGE lines.</p>}
            {(sp.ai === "busy" || sp.ai === "none") && <p className="mt-3 text-sm text-ink-soft">The full reading didn&apos;t come through this time. The defeated phrases are below. Try again in a minute.</p>}
          </Card>

          {reading && reading.lines.length > 0 && (
            <Card>
              <h2 className="h3">Who you said you are</h2>
              <ul className="mt-3 space-y-3">
                {reading.lines.map((l, i) => (
                  <li key={i} className="flex gap-3">
                    <PillarMark k={l.rule as PillarKey} size="sm" />
                    <div>
                      <p className={`text-sm font-medium ${l.fit === "supports" ? "text-link" : "text-alert"}`}>{l.fit === "supports" ? "This part sounds like you" : "The imposter is arguing with this line"}</p>
                      {lineFor(l.rule) && <p className="mt-0.5 text-sm text-ink-mute">Your line: {lineFor(l.rule)}</p>}
                      <p className="mt-1 text-[15px]">{l.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(reading?.doors.length || ruleDoors.length) ? (
            <Card>
              <h2 className="h3">Shut it down</h2>
              <p className="mt-1 text-sm text-ink-soft">Every defeated line, answered with the truth. No hype and no made-up claims.</p>
              <ul className="mt-3 space-y-3">
                {reading?.doors.length
                  ? reading.doors.map((d, i) => (
                    <li key={i} className="rounded-2xl bg-ink/[0.04] px-4 py-3">
                      <p className="text-[15px] text-ink-soft line-through decoration-ink-mute/50">{d.said}</p>
                      <p className="mt-1 text-[15px] font-medium text-heading">{d.truer}</p>
                    </li>
                  ))
                  : ruleDoors.map((d, i) => <li key={i} className="rounded-2xl bg-ink/[0.04] px-4 py-3 text-[15px]">&ldquo;{d.said}&rdquo; <span className="text-sm text-ink-mute">({d.label})</span></li>)}
              </ul>
            </Card>
          ) : reading ? <Card><p className="text-[15px]">No defeated phrases in this one.</p></Card> : null}

          {reading && (reading.chain.thought || reading.chain.stepIn) && (
            <Card>
              <h2 className="h3">The chain</h2>
              <ol className="mt-3 grid gap-2 sm:grid-cols-4">
                {([["How I think about it", reading.chain.thought], ["How I talk about it", reading.chain.words], ["How I feel", reading.chain.feeling], ["What I do", reading.chain.action]] as const).filter(([, v]) => v).map(([k, v]) => (
                  <li key={k} className="rounded-2xl bg-ink/[0.04] px-3 py-2.5"><p className="text-xs text-ink-mute">{k}</p><p className="mt-0.5 text-[15px]">{v}</p></li>
                ))}
              </ol>
              {reading.chain.stepIn && <p className="mt-3 text-[15px]"><span className="font-medium text-heading">Where to cut it off: </span>{reading.chain.stepIn}</p>}
            </Card>
          )}

          {reading?.keep && (
            <Card>
              <h2 className="h3">Your answer to the imposter</h2>
              <form action={keepToneLine} className="mt-3 space-y-3">
                <input type="hidden" name="entry" value={current.id} />
                <input name="line" defaultValue={reading.keep.text} maxLength={300} className="input" aria-label="Line to keep" />
                <div className="flex flex-wrap items-center gap-3">
                  <select name="kind" defaultValue={reading.keep.kind} className="input !w-auto" aria-label="Which C">
                    {(Object.keys(THREE_CS) as C[]).map((k) => <option key={k} value={k}>{THREE_CS[k].name}</option>)}
                  </select>
                  <Submit className="btn-quiet">Keep it</Submit>
                </div>
                <p className="text-xs text-ink-mute">Change the words until they sound like you.</p>
              </form>
            </Card>
          )}

          {reading?.question && (
            <section className="border-l-2 border-gold/60 pl-5" aria-label="Sit with this">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">Sit with this · from the book</p>
              <p className="mt-2 font-serif text-[20px] leading-snug text-heading">{reading.question}</p>
            </section>
          )}

          <form action={deleteToneEntry}><input type="hidden" name="id" value={current.id} /><button className="text-sm text-ink-mute hover:text-alert">Delete this entry</button></form>
        </section>
      )}

      <section className="mt-10">
        <h2 className="h2">The last three days</h2>
        <p className="mt-1 text-sm text-ink-soft">How often the imposter talked, counted. A pattern to notice, not a score.</p>
        <Card className="mt-3">
          {audit.length ? (
            <ul className="space-y-1.5">
              {audit.map((a) => <li key={a.label} className="flex justify-between text-[15px]"><span>&ldquo;{a.label}&rdquo;</span><span className="text-ink-soft">{a.count} {a.count === 1 ? "time" : "times"}</span></li>)}
            </ul>
          ) : <p className="text-[15px] text-ink-soft">{recent.length || profile?.toneReadsWriting ? "None found in the last three days." : "Nothing written here in the last three days."}</p>}
          <form action={setToneReadsWriting} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <input type="hidden" name="on" value={profile?.toneReadsWriting ? "false" : "true"} />
            <span className="text-sm text-ink-soft">{profile?.toneReadsWriting ? "Also counting your check-in notes and weekly look backs." : "Only what you write here is counted."}</span>
            <Submit className="btn-quiet !py-1.5 text-sm">{profile?.toneReadsWriting ? "Count only what I write here" : "Also count my check-ins and look backs"}</Submit>
          </form>
        </Card>
      </section>

      <section id="keep" className="mt-10 scroll-mt-24">
        <h2 className="h2">My answers</h2>
        <p className="mt-1 text-sm text-ink-soft">Lines that shut the imposter down, in your own words. A good one does one of three things: claim, confirm or condemn.</p>
        {sp.kept && <p role="status" className="notice mt-3">Kept.</p>}
        <div className="mt-3 space-y-3">
          {(Object.keys(THREE_CS) as C[]).map((k) => {
            const mine = lines.filter((l) => l.kind === k);
            return (
              <Card key={k}>
                <p className="text-sm"><span className="font-medium text-heading">{THREE_CS[k].name}.</span> <span className="text-ink-soft">{THREE_CS[k].line}</span></p>
                {mine.length > 0 && (
                  <ul className="mt-2 divide-y divide-line/60">
                    {mine.map((l) => (
                      <li key={l.id} className="flex items-start justify-between gap-3 py-2">
                        <span className="font-serif text-[16px] leading-snug text-heading">{l.text}</span>
                        <form action={removeToneLine}><input type="hidden" name="id" value={l.id} /><button className="text-xs text-ink-mute hover:text-alert" aria-label={`Remove ${l.text}`}>Remove</button></form>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
          <details className="card">
            <summary className="cursor-pointer text-sm text-link">Add a line of your own</summary>
            <form action={keepToneLine} className="mt-3 space-y-3">
              <input name="line" required maxLength={300} className="input" aria-label="Your line" placeholder="Something you read, heard or told yourself that's worth keeping" />
              <div className="flex flex-wrap items-center gap-3">
                <select name="kind" defaultValue="CONFIRM" className="input !w-auto" aria-label="Which C">
                  {(Object.keys(THREE_CS) as C[]).map((k) => <option key={k} value={k}>{THREE_CS[k].name}</option>)}
                </select>
                <Submit className="btn-quiet">Keep it</Submit>
              </div>
            </form>
          </details>
        </div>
      </section>

      {entries.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer text-sm text-link">Earlier entries ({entries.length})</summary>
          <ul className="mt-3 divide-y divide-line/60">
            {entries.map((e) => {
              const n = (JSON.parse(e.closedDoor || "[]") as string[]).length;
              return (
                <li key={e.id} className="py-2.5">
                  <Link href={`/tone?entry=${e.id}`} className="block hover:text-link">
                    <span className="block text-xs text-ink-mute">{fmt(e.createdAt, { month: "short", day: "numeric" })}{n ? ` · ${n} defeated ${n === 1 ? "phrase" : "phrases"}` : ""}</span>
                    <span className="line-clamp-2 text-[15px]">{e.text}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      <p className="mt-8 text-xs text-ink-mute">Private. Your coach doesn&apos;t see anything here. Set the Tone is a coach, not therapy.</p>
    </>
  );
}
