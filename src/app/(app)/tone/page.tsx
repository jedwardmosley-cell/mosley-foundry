import Link from "next/link";
import { NAMES } from "@/content/names";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmt, addDays, ymd } from "@/lib/dates";
import { consoleExercise, findClosedDoors, tally, bookQuestions, type DoorHit } from "@/lib/tone";
import { getContent } from "@/content";
import { aiAvailable, type ToneReading, type ConversationReading } from "@/lib/ai";
import { readSelfTalk, prepConversation, practiceConversation, keepToneLine, deleteToneEntry, setToneReadsWriting, setToneAudit } from "@/app/actions/tone";

const fmtDay = (d: Date) => fmt(d, { weekday: "long", month: "short", day: "numeric" });
import { PageHeader, ChapterOpening, Card, PillarMark } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { DictationHint } from "@/components/Picks";
import { FORGE_LINES } from "@/content/forgeLines";
import { THREE_CS, type ThreeC } from "@/content/threeCs";
import { InTheBook } from "@/components/InTheBook";
import type { PillarKey } from "@/content/types";

export const metadata = { title: "Set the Tone" };

type C = ThreeC;

const Label = ({ children, gold = false }: { children: React.ReactNode; gold?: boolean }) => (
  <p className={`text-[13px] font-bold ${gold ? "text-gold" : "text-ink-mute"}`}>{children}</p>
);

/**
 * Set the Tone: language with power. With myself, it catches limited language in what the client tells
 * themselves and gives a new way to say it. With someone else ("How do I say it?"), it helps them set the
 * tone before a conversation that matters. Read against their own five FORGE lines. Private.
 */
export default async function TonePage({ searchParams }: { searchParams: Promise<{ entry?: string; care?: string; ai?: string; kept?: string; mode?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser("PARTICIPANT");
  const [entries, lines, profile, current] = await Promise.all([
    db.toneEntry.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.toneLine.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
    db.profile.findUnique({ where: { userId: u.id }, select: { toneReadsWriting: true, toneAuditAt: true, aiEnabled: true, destination: true, lineO: true, why: true, lineG: true, lineE: true } }),
    sp.entry ? db.toneEntry.findFirst({ where: { id: sp.entry, userId: u.id } }) : null,
  ]);
  const mode: "SELF" | "OTHERS" = current ? (current.mode === "OTHERS" ? "OTHERS" : "SELF") : sp.mode === "others" ? "OTHERS" : "SELF";
  const aiOn = aiAvailable() && profile?.aiEnabled !== false;

  // The three-day count: limited language in what the client told themselves, and, if they turned it on, in what they write elsewhere.
  // The book's three-day audit runs from the day the client starts it: day 1, 2 and 3, then their pattern.
  const auditStart = profile?.toneAuditAt ?? null;
  const auditEnd = auditStart ? addDays(auditStart, 3) : null;
  const auditState: "none" | "running" | "done" = !auditStart ? "none" : new Date() < auditEnd! ? "running" : "done";
  const auditDay = auditStart ? Math.min(3, Math.floor((Date.now() - auditStart.getTime()) / 864e5) + 1) : 0;
  const inAudit = (d: Date) => !!auditStart && d >= auditStart && d < auditEnd!;
  const recent = entries.filter((e) => e.mode === "SELF" && inAudit(e.createdAt));
  const hits: DoorHit[] = recent.flatMap((e) => findClosedDoors(e.text));
  if (profile?.toneReadsWriting && auditStart) {
    const [checkIns, weeks] = await Promise.all([
      db.dailyCheckIn.findMany({ where: { userId: u.id, date: { gte: ymd(auditStart), lt: ymd(auditEnd!) } }, select: { note: true, reflection: true, identityNote: true } }),
      db.weeklyReflection.findMany({ where: { userId: u.id, createdAt: { gte: auditStart, lt: auditEnd! } }, select: { built: true, avoided: true, nextWeek: true } }),
    ]);
    for (const c of checkIns) hits.push(...findClosedDoors([c.note, c.reflection, c.identityNote].join(" ")));
    for (const w of weeks) hits.push(...findClosedDoors([w.built, w.avoided, w.nextWeek].join(" ")));
  }
  const audit = tally(hits);
  const self: ToneReading | null = current?.mode !== "OTHERS" && current?.reading ? JSON.parse(current.reading) : null;
  const talk: ConversationReading | null = current?.mode === "OTHERS" && current.reading ? JSON.parse(current.reading) : null;
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
  const modeEntries = entries.filter((e) => (e.mode === "OTHERS") === (mode === "OTHERS"));
  const doorList = (self?.doors.length ? self.doors : ruleDoors.map((d) => ({ said: d.said, truer: d.instead, why: d.why })));

  return (
    <>
      <ChapterOpening image="/chapters/center-console.jpg" alt="The center console: the climate dials and the shifter" title={NAMES.tone.name} plain={NAMES.tone.plain}>
        How you talk to yourself, and to the people around you, sets the tone before anything else happens. Use it when your own words start to limit you, and before a conversation that matters.
        <span className="mt-4 block border-l-4 border-lane pl-4 text-[15px] text-ink">
          <span className="block font-medium text-heading">Your words are instructions.</span>
          They&apos;re more than a way to say what you think. They tell your brain what to believe, and they set the temperature for everyone who hears them. Say &ldquo;I can&apos;t&rdquo; and your mind goes looking for proof that you can&apos;t. It finds it, and your body follows. Blame someone and they defend instead of fix. This is nothing to play with.
        </span>
      </ChapterOpening>

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

      {/* Two modes: with myself (self-talk) and with someone else (how do I say it). */}
      <nav aria-label="Set the Tone mode" className="seg mb-4 grid-cols-2">
        <Link href="/tone" aria-current={mode === "SELF" ? "page" : undefined} className={`seg-opt text-center ${mode === "SELF" ? "bg-surface text-heading shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_14px_-8px_rgb(0_0_0/0.3)]" : ""}`}>With myself</Link>
        <Link href="/tone?mode=others" aria-current={mode === "OTHERS" ? "page" : undefined} className={`seg-opt text-center ${mode === "OTHERS" ? "bg-surface text-heading shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_14px_-8px_rgb(0_0_0/0.3)]" : ""}`}>With someone else</Link>
      </nav>

      <Card>
        {mode === "SELF" ? (
          <form action={readSelfTalk} className="space-y-3">
            <label htmlFor="said" className="label">What did you just tell yourself?</label>
            <textarea id="said" name="said" required minLength={3} maxLength={3000} className="textarea !min-h-[110px]"
              placeholder="Word for word, the way it sounded. &quot;I can't run this meeting. They never listen to me anyway.&quot;" />
            <DictationHint />
            <div className="flex flex-wrap items-center gap-3">
              <Submit>Rewrite it</Submit>
              <span className="text-sm text-ink-soft">{hasLines ? "Read against your five FORGE lines." : <>Works best once you&apos;ve written your five lines in <Link href="/identity" className="btn-link">Who&apos;s behind the wheel</Link>.</>}</span>
            </div>
          </form>
        ) : (
          <form action={prepConversation} className="space-y-3">
            <h2 className="h3">How do I say it?</h2>
            <p className="text-sm text-ink-soft">Before a hard conversation, or when you want to lead or encourage someone. Set a tone of confidence, with room for them to be honest.</p>
            <label className="block"><span className="label">Who&apos;s it with?</span><input name="who" maxLength={200} className="input" placeholder="My direct report, a client, my teenager" /></label>
            <label className="block"><span className="label">What&apos;s going on?</span><textarea name="situation" required minLength={3} maxLength={2000} className="textarea !min-h-[80px]" placeholder="They missed the deadline again, and the client noticed." /></label>
            <label className="block"><span className="label">What are you tempted to say? <span className="font-normal text-ink-mute">(optional)</span></span><textarea name="tempted" maxLength={2000} className="textarea !min-h-[70px]" placeholder="&quot;You didn't do this again. What's wrong with you?&quot;" /></label>
            <DictationHint />
            <Submit>How do I say it?</Submit>
          </form>
        )}
      </Card>

      {mode === "SELF" && todaysQuestion && !current && !sp.care && (
        <section className="mt-6 border-l-4 border-lane pl-5" aria-label="From the book">
          <Label gold>From the book</Label>
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

      {/* With myself: the reading. */}
      {current && current.mode !== "OTHERS" && !sp.care && (
        <section className="mt-6 space-y-4" aria-label="The reading">
          <Card>
            <p className="text-xs text-ink-mute">You told yourself, {fmt(current.createdAt, { weekday: "short", hour: "numeric", minute: "2-digit" })}</p>
            <p className="mt-1 font-serif text-[18px] leading-snug text-heading">&ldquo;{current.text}&rdquo;</p>
            {self?.summary && <p className="mt-3 text-[15px]">{self.summary}</p>}
            {sp.ai === "off" && <p className="mt-3 text-sm text-ink-soft">Help me with this is off, so this covers the phrases the app knows. Turn it on in Settings to read every word against your FORGE lines.</p>}
            {(sp.ai === "busy" || sp.ai === "none") && <p className="mt-3 text-sm text-ink-soft">The full reading didn&apos;t come through this time. The phrases the app knows are below. Try again in a minute.</p>}
          </Card>

          {doorList.length ? (
            <Card>
              <h2 className="h3">Limited language</h2>
              <p className="mt-1 text-sm text-ink-soft">Every limiting line gets a new way to say it. Say it out loud.</p>
              <ul className="mt-4 space-y-4">
                {doorList.map((d, i) => (
                  <li key={i} className="rounded-2xl bg-ink/[0.04] px-4 py-4">
                    <p className="text-[15px] text-ink-mute line-through decoration-alert/60">{d.said}</p>
                    <div className="mt-3"><Label gold>Say this instead</Label></div>
                    <p className="mt-1 font-serif text-[21px] leading-snug text-heading">{d.truer}</p>
                    {d.why && <><div className="mt-3"><Label>Why it matters</Label></div><p className="mt-1 text-[15px] text-ink">{d.why}</p></>}
                  </li>
                ))}
              </ul>
            </Card>
          ) : self ? <Card><p className="text-[15px]">No limited language in this one.</p></Card> : null}

          {self?.byName && (
            <Card>
              <h2 className="h3">Coach yourself by name</h2>
              <p className="mt-1 text-sm text-ink-soft">Talk to yourself the way a good coach would. Using your own name puts a little distance between you and the moment.</p>
              <p className="mt-3 font-serif text-[19px] leading-snug text-heading">{self.byName}</p>
            </Card>
          )}

          {self && self.lines.length > 0 && (
            <Card>
              <h2 className="h3">Who you said you are</h2>
              <ul className="mt-3 space-y-3">
                {self.lines.map((l, i) => (
                  <li key={i} className="flex gap-3">
                    <PillarMark k={l.rule as PillarKey} size="sm" />
                    <div>
                      <p className={`text-sm font-medium ${l.fit === "supports" ? "text-link" : "text-alert"}`}>{l.fit === "supports" ? "This part sounds like you" : "These words work against this line"}</p>
                      {lineFor(l.rule) && <p className="mt-0.5 text-sm text-ink-mute">Your line: {lineFor(l.rule)}</p>}
                      <p className="mt-1 text-[15px]">{l.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {self && (self.chain.thought || self.chain.stepIn) && (
            <Card>
              <h2 className="h3">The chain</h2>
              <p className="mt-1 text-[15px] text-ink-soft">Words don&apos;t stay words. How you think about something shapes how you talk about it. How you talk about it shapes how you feel. How you feel shows up in what you do. Here is that chain for what you wrote, link by link, so you can see where to step in.</p>
              <ol className="mt-3 space-y-1.5">
                {([["How I think about it", self.chain.thought], ["So I talk about it like this", self.chain.words], ["So I feel", self.chain.feeling], ["So I do this", self.chain.action]] as const).filter(([, v]) => v).map(([k, v], i) => (
                  <li key={k} className="flex gap-3 rounded-2xl bg-ink/[0.04] px-3 py-2.5">
                    <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy text-[12px] font-bold text-white">{i + 1}</span>
                    <span><span className="block text-xs text-ink-mute">{k}</span><span className="block mt-0.5 text-[15px]">{v}</span></span>
                  </li>
                ))}
              </ol>
              {self.chain.stepIn && (
                <div className="mt-3 border-l-2 border-ink/20 pl-4">
                  <p className="text-sm font-bold text-heading">Where to step in</p>
                  <p className="mt-0.5 text-[15px]">{self.chain.stepIn}</p>
                  <p className="mt-1 text-sm text-ink-soft">Change one link and the ones after it change too. The earlier you step in, the less you have to fight later.</p>
                </div>
              )}
              <InTheBook lines={consoleExercise(pack.chapters, "chain")} />
            </Card>
          )}

          {/* Every reading ends with the offer to keep a line: the client's own library, built as they go. */}
          <KeepLine entry={current.id} kept={!!sp.kept} text={self?.keep?.text || doorList[0]?.truer || ""} kind={self?.keep?.kind ?? "CONFIRM"} />

          {self?.question && (
            <section className="border-l-4 border-lane pl-5" aria-label="Sit with this">
              <Label gold>Sit with this, from the book</Label>
              <p className="mt-2 font-serif text-[20px] leading-snug text-heading">{self.question}</p>
            </section>
          )}

          <form action={deleteToneEntry}><input type="hidden" name="id" value={current.id} /><button className="text-sm text-ink-mute hover:text-alert">Delete this entry</button></form>
        </section>
      )}

      {/* With someone else: how do I say it. */}
      {current && current.mode === "OTHERS" && !sp.care && (
        <section className="mt-6 space-y-4" aria-label="How to say it">
          <Card>
            <p className="text-xs text-ink-mute">Before you talk{current.who ? ` with ${current.who}` : ""}, {fmt(current.createdAt, { weekday: "short", hour: "numeric", minute: "2-digit" })}</p>
            <p className="mt-1 text-[15px]">{current.situation}</p>
            {talk?.tone && <><div className="mt-4"><Label gold>The tone to set</Label></div><p className="mt-1 text-[15px] text-ink">{talk.tone}</p></>}
            {sp.ai === "off" && <p className="mt-3 text-sm text-ink-soft">Help me with this is off. Turn it on in Settings to get an opener, a rewrite and questions to ask for this conversation.</p>}
            {(sp.ai === "busy" || sp.ai === "none") && <p className="mt-3 text-sm text-ink-soft">The reading didn&apos;t come through this time. Try again in a minute.</p>}
          </Card>

          {talk?.opener && (
            <Card>
              <Label gold>Open with this</Label>
              <p className="mt-2 font-serif text-[22px] leading-snug text-heading">{talk.opener}</p>
              <p className="mt-2 text-xs text-ink-mute">The first few seconds set the temperature for everything after.</p>
            </Card>
          )}

          {(talk?.rewrite || ruleDoors.length > 0) && (
            <Card>
              {current.text && <p className="text-[15px] text-ink-mute line-through decoration-alert/60">{current.text}</p>}
              {talk?.rewrite && <><div className="mt-3"><Label gold>Say this instead</Label></div><p className="mt-1 font-serif text-[20px] leading-snug text-heading">{talk.rewrite}</p></>}
              {talk?.why && <><div className="mt-3"><Label>Why it matters</Label></div><p className="mt-1 text-[15px] text-ink">{talk.why}</p></>}
            </Card>
          )}

          {talk && talk.questions.length > 0 && (
            <Card>
              <h2 className="h3">Questions to ask</h2>
              <p className="mt-1 text-sm text-ink-soft">So they talk and you listen.</p>
              <ul className="mt-3 space-y-2">{talk.questions.map((q) => <li key={q} className="rounded-2xl bg-ink/[0.04] px-4 py-2.5 text-[15px]">{q}</li>)}</ul>
            </Card>
          )}

          {talk?.sideways && (
            <Card>
              <h2 className="h3">If it goes sideways</h2>
              <p className="mt-2 font-serif text-[18px] leading-snug text-heading">{talk.sideways}</p>
            </Card>
          )}

          {talk?.identity && <p className="px-1 text-[15px] text-ink-soft"><span className="font-medium text-heading">Who you said you are: </span>{talk.identity}</p>}

          {aiOn && (
            <form action={practiceConversation} className="card flex flex-wrap items-center justify-between gap-3">
              <input type="hidden" name="id" value={current.id} />
              <span className="text-[15px]"><span className="block font-medium text-heading">Practice it</span><span className="text-sm text-ink-soft">Rehearse it first. Help me with this plays {current.who || "the other person"}.</span></span>
              <Submit className="btn-quiet">Practice it</Submit>
            </form>
          )}

          <KeepLine entry={current.id} kept={!!sp.kept} text={talk?.rewrite || ""} kind="CLAIM" others />

          <form action={deleteToneEntry}><input type="hidden" name="id" value={current.id} /><button className="text-sm text-ink-mute hover:text-alert">Delete this entry</button></form>
        </section>
      )}

      {/* Self-talk only from here: the count and my lines belong to "With myself". */}
      {mode === "SELF" && (<>

      <section id="keep" className="mt-10 scroll-mt-24">
        <Link href="/glovebox" className="card block transition hover:bg-ink/[0.03]">
          <p className="flex items-center justify-between"><span className="h3">The Glove Box</span><span className="text-sm text-link">Open</span></p>
          <p className="mt-1 text-[15px] text-ink-soft">{lines.length ? `${lines.length} power ${lines.length === 1 ? "statement" : "statements"} kept within reach, sorted by claim, confirm and condemn.` : "Where your power statements go: lines that claim, confirm or condemn, kept within reach. Nothing in it yet."}</p>
          {lines[0] && <p className="mt-2 font-serif text-[17px] leading-snug text-heading">&ldquo;{lines[0].text}&rdquo;</p>}
          {sp.kept && !current && <p role="status" className="notice mt-3">In your Glove Box.</p>}
        </Link>
      </section>
      </>)}

      {modeEntries.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer text-sm text-link">{mode === "OTHERS" ? "Earlier conversations" : "Earlier entries"} ({modeEntries.length})</summary>
          <ul className="mt-3 divide-y divide-line/60">
            {modeEntries.map((e) => {
              const n = (JSON.parse(e.closedDoor || "[]") as string[]).length;
              return (
                <li key={e.id} className="py-2.5">
                  <Link href={`/tone?entry=${e.id}`} className="block hover:text-link">
                    <span className="block text-xs text-ink-mute">{fmt(e.createdAt, { month: "short", day: "numeric" })}{e.mode === "OTHERS" ? `, with ${e.who || "someone else"}` : n ? `, ${n} limiting ${n === 1 ? "phrase" : "phrases"}` : ""}</span>
                    <span className="line-clamp-2 text-[15px]">{e.mode === "OTHERS" ? e.situation : e.text}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {mode === "SELF" && (<>
      {/* Optional, so it sits folded at the bottom. Closed, it shows where it stands. */}
      <section className="mt-10">
        <details className="group/audit border-t border-line/70 pt-5">
        <summary className="flex cursor-pointer list-none items-baseline gap-3">
          <h2 className="h3 flex-1">Three-day language audit</h2>
          <span className="shrink-0 text-[14px] text-ink-mute">{auditState === "running" ? `Day ${auditDay} of 3` : auditState === "done" ? "Done" : "Optional"}</span>
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rotate-45 border-b-[1.6px] border-r-[1.6px] border-ink-mute transition group-open/audit:-rotate-[135deg]" />
        </summary>
        <p className="mt-1 text-[15px] text-ink-soft">For three days, catch every time you say something that shuts a door before you&apos;ve tried, like &ldquo;I can&apos;t&rdquo;, &ldquo;I don&apos;t know&rdquo; or &ldquo;that&apos;s just how I am&rdquo;, and replace it with something that leaves a door open. One slip is noise. Three days is enough to see your pattern, and the phrase at the top is the one to replace first.</p>
        <InTheBook lines={consoleExercise(pack.chapters, "audit")} />
        <Card className="mt-3">
          {auditState === "none" && (
            <form action={setToneAudit}>
              <input type="hidden" name="on" value="true" />
              <p className="text-[15px]">Start whenever you&apos;re ready. Each time you catch yourself, write it under With myself at the top of this page. It&apos;s counted here, with a better way to say it.</p>
              <Submit className="btn-primary mt-3">Start my three days</Submit>
            </form>
          )}
          {auditState !== "none" && (
            <p className="mb-3 text-[15px]">
              {auditState === "running"
                ? <><span className="font-bold text-heading">Day {auditDay} of 3.</span> Ends {fmtDay(auditEnd!)}. Each time you catch yourself, write it under With myself at the top.</>
                : <><span className="font-bold text-heading">Your three days are done.</span> {fmtDay(auditStart!)} to {fmtDay(addDays(auditEnd!, -1))}. {audit.length ? "Here is your pattern." : "Nothing shut a door in what you wrote. That's worth noticing too."}</>}
            </p>
          )}
          {auditState !== "none" && audit.length > 0 && (
            <ul className="divide-y divide-line/60">
              {audit.map((a, i) => (
                <li key={a.label} className="py-2 first:pt-0">
                  <p className="flex justify-between gap-3 text-[15px]"><span className="font-medium text-heading">&ldquo;{a.label}&rdquo;</span><span className="shrink-0 text-ink-soft">{a.count} {a.count === 1 ? "time" : "times"}</span></p>
                  <p className="mt-0.5 text-sm text-ink-soft">{i === 0 && auditState === "done" ? "Replace this one first. " : ""}Say instead: <span className="text-ink">{a.instead}</span></p>
                </li>
              ))}
            </ul>
          )}
          {auditState === "running" && audit.length === 0 && <p className="text-[15px] text-ink-soft">Nothing counted yet.</p>}
          {auditState !== "none" && (
            <form action={setToneAudit} className="mt-3">
              <input type="hidden" name="on" value={auditState === "done" ? "true" : "false"} />
              <Submit className="btn-quiet !py-1.5 text-sm">{auditState === "done" ? "Start another three days" : "Stop the audit"}</Submit>
            </form>
          )}
          {auditState === "running" && <form action={setToneReadsWriting} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <input type="hidden" name="on" value={profile?.toneReadsWriting ? "false" : "true"} />
            <span className="text-sm text-ink-soft">{profile?.toneReadsWriting ? "Also counting your daily check-in notes and the Mirrors. Nothing is shared, it only adds to this count." : "Only what you write here is counted. You can also count your daily check-in notes and the Mirrors. Nothing is shared."}</span>
            <Submit className="btn-quiet !py-1.5 text-sm">{profile?.toneReadsWriting ? "Count only what I write here" : "Also count my check-ins and the Mirrors"}</Submit>
          </form>}
        </Card>
        </details>
      </section>
      </>)}
      <p className="mt-8 text-xs text-ink-mute">Private. Your coach doesn&apos;t see anything here. Set the Tone is a coach, not therapy.</p>
    </>
  );
}

/** The offer at the end of a reading: put a line in the Glove Box. Pre-filled when the reading has one; edit until it sounds like you. */
function KeepLine({ entry, kept, text, kind, others = false }: { entry: string; kept: boolean; text: string; kind: string; others?: boolean }) {
  return (
    <Card id="keep-line" className="scroll-mt-24">
      <h2 className="h3">Put a line in the Glove Box</h2>
      <p className="mt-1 text-sm text-ink-soft">{others ? "A line from this conversation worth keeping, in your own words." : "A line from this worth keeping. Change the words until they sound like you."}</p>
      <form action={keepToneLine} className="mt-3 space-y-3">
        <input type="hidden" name="entry" value={entry} />
        <input name="line" required defaultValue={text} maxLength={300} className="input" aria-label="Line to keep" placeholder="Write the line you want to keep" />
        <div className="flex flex-wrap items-center gap-3">
          <select name="kind" defaultValue={kind} className="input !w-auto" aria-label="Which C">
            {(Object.keys(THREE_CS) as C[]).map((k) => <option key={k} value={k}>{THREE_CS[k].name}</option>)}
          </select>
          <Submit className="btn-quiet">Put it in the Glove Box</Submit>
        </div>
        {kept && <p role="status" className="notice">In your Glove Box. <Link href="/glovebox" className="btn-link">Open it</Link></p>}
      </form>
    </Card>
  );
}
