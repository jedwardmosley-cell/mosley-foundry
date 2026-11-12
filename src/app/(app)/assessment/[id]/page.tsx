import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { scoresFrom, interpret, entrepreneurPatterns } from "@/lib/forge";
import { reviseAssessment, setPriority } from "@/app/actions/participant";
import { fmt } from "@/lib/dates";
import { PILLAR_KEYS, type PillarKey } from "@/content/types";
import { PageHeader, Card, PillarMark, Gauge, Source, Draft } from "@/components/ui";
import { Submit } from "@/components/Submit";

export const metadata = { title: "Your FORGE Profile" };

export default async function AssessmentResult({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ focus?: string; next?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { id } = await params;
  const { focus, next } = await searchParams;
  const a = await db.assessment.findFirst({ where: { id, userId: u.id } });
  if (!a) notFound();
  const profile = await db.profile.findUnique({ where: { userId: u.id } });
  const { pack, entrepreneur } = await getContent();
  const s = scoresFrom(a);
  const focusKey = (PILLAR_KEYS as string[]).includes(focus ?? "") ? (focus as PillarKey) : undefined;
  const r = interpret(pack, s, focusKey ?? (profile?.priorityPillar as PillarKey | undefined));
  const fp = pack.pillars.find((p) => p.key === r.focus)!;
  const patterns = a.instrument === "FORGE_ENTREPRENEUR" ? entrepreneurPatterns(entrepreneur, s) : [];
  const words = JSON.parse(a.oneWords || "{}") as Record<string, string>;
  const revised = a.revisedF != null;
  const nearest = pack.profiles
    .map((p) => ({ p, d: PILLAR_KEYS.reduce((n, k) => n + Math.abs((p.scores[k] ?? 3) - s[k]), 0) }))
    .sort((x, y) => x.d - y.d)[0];

  return (
    <>
      <PageHeader eyebrow={`Section Two · ${fmt(a.completedAt, { month: "long", day: "numeric", year: "numeric" })}`} title="Your Score Profile">
        Your five scores are not five separate grades. They are a pattern.
        {a.instrument === "FORGE_DRAFT" && <span className="ml-2"><Draft>Draft instrument</Draft></span>}
      </PageHeader>

      <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
        <Card>
          <p className="eyebrow">{revised ? "Revised scores" : "Your scores"}</p>
          <ul className="mt-4 space-y-3">
            {pack.pillars.map((p) => (
              <li key={p.key} className="flex items-center gap-3">
                <PillarMark k={p.key} size="sm" />
                <span className="flex-1 text-[15px]">{p.name}</span>
                <Gauge value={s[p.key]} label={p.name} />
                <span className="w-6 text-right font-serif">{s[p.key]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-line pt-4 flex justify-between"><span className="muted">Total</span><span className="font-serif text-xl">{r.total} / 25</span></p>
          <p className="mt-2 text-xs text-ink-mute">These are your own ratings. FORGE is a development tool. It has not been validated as a psychometric instrument, and its scores can't be compared to EQ-i scores.</p>
        </Card>

        <Card>
          {r.band && <><p className="eyebrow">Reading your total: {r.band.label}</p><p className="mt-2 text-[15px] leading-relaxed">{r.band.text}</p></>}
          {pack.patternNote && <p className="quote mt-5 text-[15px]">{pack.patternNote}</p>}
          {r.flat && <p className="mt-4 text-sm text-clay">All five scores are the same. If you had to order them from strongest to weakest, which is fifth? That one is your real lowest. Choose it below.</p>}
        </Card>
      </div>

      {patterns.map((pt) => (
        <Card key={pt.id} className="mt-5 border-brass/50">
          <p className="eyebrow">The pattern to watch for</p>
          <h2 className="h2 mt-1">{pt.title}</h2>
          {pt.text.map((t) => <p key={t} className="mt-2 text-[15px] leading-relaxed">{t}</p>)}
          <Source>{entrepreneur?.source.title}</Source>
        </Card>
      ))}

      <Card className="mt-5">
        <p className="eyebrow">If your lowest score is here, do this</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {r.lowest.length > 1 && <span className="text-sm muted mr-1">Tied lowest:</span>}
          {(r.lowest.length > 1 ? r.lowest : PILLAR_KEYS).map((k) => (
            <a key={k} href={`?focus=${k}`} className={`chip ${k === r.focus ? "!bg-navy !text-white !border-navy" : ""}`}>{k} · {s[k]}</a>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <PillarMark k={fp.key} size="lg" />
          <div><h2 className="h2">{fp.name}</h2><p className="text-sm muted">Score {s[fp.key]}</p></div>
        </div>
        <p className="mt-4 text-[15px] leading-relaxed">{r.guidance?.text}</p>
        <form action={setPriority} className="mt-5 flex flex-wrap items-center gap-3">
          <input type="hidden" name="pillar" value={fp.key} />
          {next === "start" && <input type="hidden" name="next" value="/start" />}
          <Submit>{profile?.priorityPillar === fp.key ? "This is my priority" : `Make ${fp.name} my development priority`}</Submit>
          <span className="text-sm muted">One pillar with real attention produces more than five with divided attention.</span>
        </form>
        <Source>Personal Application Workbook, Section Two</Source>
      </Card>

      <a href="/identity" className="card block mt-5 hover:border-navy/40">
        <p className="eyebrow">Optional next step</p>
        <h2 className="h2 mt-1">Identity shift spectrum</h2>
        <p className="mt-2 text-[15px] muted">Your scores show where you are. This asks you to claim who you are and how big a change you want to make. You choose the level. Your scores do not decide it.</p>
      </a>

      {nearest && pack.profiles.length > 0 && (
        <Card className="mt-5">
          <p className="eyebrow">FORGE in the Wild · closest pattern</p>
          <h2 className="h2 mt-1">{nearest.p.name}</h2>
          <p className="muted text-sm">{nearest.p.subtitle} · a fictitious composite drawn from the book</p>
          <p className="mt-3 text-sm muted">{PILLAR_KEYS.map((k) => `${k} ${nearest.p.scores[k]}`).join(" · ")}</p>
          {nearest.p.designedDiscipline && <p className="mt-3 text-[15px] leading-relaxed"><span className="font-medium">Designed discipline factor. </span>{nearest.p.designedDiscipline}</p>}
          {nearest.p.lesson && <p className="mt-3 text-[15px] leading-relaxed"><span className="font-medium">The lesson. </span>{nearest.p.lesson}</p>}
          <Source>Personal Application Workbook, Section Three</Source>
        </Card>
      )}

      <Card className="mt-5">
        <p className="eyebrow">Verify</p>
        <h2 className="h2 mt-1">Full behavioral anchor tables</h2>
        <p className="mt-2 text-[15px] muted">Read these, then revise any score that shifted. Many people score themselves differently once they see the full descriptions. That shift is the diagnostic working as intended.</p>
        <form action={reviseAssessment} className="mt-5 space-y-6">
          <input type="hidden" name="id" value={a.id} />
          {pack.pillars.map((p) => (
            <details key={p.key} className="rounded-xl border border-line bg-white p-4" open={p.key === r.focus}>
              <summary className="cursor-pointer flex items-center gap-3"><PillarMark k={p.key} size="sm" /><span className="font-medium">{p.name}</span><span className="ml-auto text-sm muted">first score {({ F: a.f, O: a.o, R: a.r, G: a.g, E: a.e })[p.key]}</span></summary>
              <p className="mt-3 text-sm muted">{p.definition}</p>
              <div className="mt-3 space-y-2">
                {p.anchors.map((an) => (
                  <label key={an.score} className="flex gap-3 rounded-lg p-2 hover:bg-paper cursor-pointer">
                    <input type="radio" name={p.key} value={an.score} defaultChecked={s[p.key] === an.score} className="mt-1 accent-navy" />
                    <span><span className="font-serif">{an.score}</span> <span className="font-medium">{an.level}.</span> <span className="text-[14px] text-ink-soft">{an.text}</span></span>
                  </label>
                ))}
              </div>
              <label className="block mt-3"><span className="label">One word that captures it</span><input name={`w${p.key}`} defaultValue={words[p.key]} maxLength={40} className="input max-w-xs" /></label>
            </details>
          ))}
          <Submit className="btn-quiet">Save revised scores</Submit>
        </form>
        <Source>Personal Application Workbook, Full Behavioral Anchor Tables</Source>
      </Card>
    </>
  );
}
