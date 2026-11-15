import { notFound } from "next/navigation";
import Link from "next/link";
import { FEEDBACK_COPY } from "@/content/feedback";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { scoresFrom, interpret, entrepreneurPatterns } from "@/lib/forge";
import { setPriority } from "@/app/actions/participant";
import { fmt } from "@/lib/dates";
import { PILLAR_KEYS, type PillarKey } from "@/content/types";
import { PageHeader, Card, PillarMark, Draft } from "@/components/ui";
import { AssessmentForm } from "@/components/AssessmentForm";
import { ForgeReadout } from "@/components/ForgeReadout";
import { linesOf } from "@/content/forgeLines";
import { Submit } from "@/components/Submit";

export const metadata = { title: "My FORGE profile" };

export default async function AssessmentResult({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ focus?: string; next?: string; edit?: string; updated?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { id } = await params;
  const { focus, next, edit, updated } = await searchParams;
  const a = await db.assessment.findFirst({ where: { id, userId: u.id } });
  if (!a) notFound();
  const profile = await db.profile.findUnique({ where: { userId: u.id } });
  const { pack, entrepreneur } = await getContent();
  const s = scoresFrom(a);
  const focusKey = (PILLAR_KEYS as string[]).includes(focus ?? "") ? (focus as PillarKey) : undefined;
  const r = interpret(pack, s, focusKey ?? (profile?.priorityPillar as PillarKey | undefined));
  const fp = pack.pillars.find((p) => p.key === r.focus)!;
  const patterns = a.instrument === "FORGE_ENTREPRENEUR" ? entrepreneurPatterns(entrepreneur, s) : [];
  const revised = a.revisedF != null;
  const lines = linesOf(profile);
  const identity = await db.identityProfile.findUnique({ where: { userId: u.id }, select: { role: true } });
  const useEntre = a.instrument === "FORGE_ENTREPRENEUR" && !!entrepreneur;
  // My feedback, if the client tagged it to pillars: their own reading, shown beside the scores, never as a score.
  const fb = await db.feedback.findFirst({ where: { userId: u.id, NOT: { pillars: "[]" } }, orderBy: [{ takenOn: "desc" }, { createdAt: "desc" }], select: { id: true, title: true, takenOn: true, pillars: true } });
  const fbPillars = fb ? (JSON.parse(fb.pillars) as PillarKey[]) : [];

  return (
    <>
      <PageHeader eyebrow={`FORGE · ${fmt(a.completedAt, { month: "long", day: "numeric", year: "numeric" })}`} title={edit ? "Update my ratings" : "My FORGE profile"}>
        {edit ? "Read each level again and choose the one that is true of you now." : "Your five scores are not five separate grades. They are a pattern."}
        {a.instrument === "FORGE_DRAFT" && <span className="ml-2"><Draft>Draft instrument</Draft></span>}
      </PageHeader>

      {edit ? (
        <AssessmentForm pack={pack} entrepreneur={entrepreneur} useEntre={useEntre} instrument={a.instrument} lines={lines} role={identity?.role} defaults={s} reviseId={a.id} />
      ) : (
      <>
      {updated && <p role="status" className="notice mb-5">Your ratings are updated.</p>}
      <Card>
        <p className="eyebrow">{revised ? "My updated ratings" : "My ratings"}</p>
        <div className="mt-4"><ForgeReadout pack={pack} scores={s} lines={lines} /></div>
        <p className="mt-5 border-t border-line pt-4 text-sm text-ink-soft">The goal is a 5 on every rule. It&apos;s a pursuit that doesn&apos;t end.</p>
        <p className="mt-2 text-xs text-ink-mute">These are your own ratings. FORGE is a development tool. It has not been validated as a psychometric instrument, and its scores can&apos;t be compared to EQ-i scores.</p>
        <Link href={`/assessment/${a.id}?edit=1`} className="btn-quiet mt-4 inline-flex">Update my ratings</Link>
      </Card>

      {(pack.patternNote || r.flat) && (
        <Card className="mt-5">
          {pack.patternNote && <p className="quote text-[15px]">{pack.patternNote}</p>}
          {r.flat && <p className="mt-4 text-sm text-alert">All five scores are the same. If you had to order them from strongest to weakest, which is fifth? That one is your real lowest. Choose it below.</p>}
        </Card>
      )}

      {patterns.map((pt) => (
        <Card key={pt.id} className="mt-5 border-line">
          <p className="eyebrow">The pattern to watch for</p>
          <h2 className="h2 mt-1">{pt.title}</h2>
          {pt.text.map((t) => <p key={t} className="mt-2 text-[15px] leading-relaxed">{t}</p>)}
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
          <Submit>Choose my focus</Submit>
          <span className="text-sm muted">The goal is a 5 on every rule. Next you&apos;ll choose one or two things to work on.</span>
        </form>
      </Card>

      {fb && fbPillars.length > 0 && (
        <Link href={`/feedback/${fb.id}`} className="card mt-5 block hover:border-navy/40">
          <p className="eyebrow">From my feedback</p>
          <h2 className="h2 mt-1 flex flex-wrap items-center gap-2">{fbPillars.map((k) => <PillarMark key={k} k={k} size="sm" />)} My feedback points to {fbPillars.map((k) => pack.pillars.find((p) => p.key === k)?.name).join(" and ")}</h2>
          <p className="mt-2 text-[15px] muted">{fb.title}{fb.takenOn ? `, ${fmt(fb.takenOn, { month: "long", year: "numeric" })}` : ""}. {FEEDBACK_COPY.notSameMeasure}</p>
        </Link>
      )}

      <a href="/identity" className="card block mt-5 hover:border-navy/40">
        <p className="eyebrow">FORGE · Step 1</p>
        <h2 className="h2 mt-1">Who's behind the wheel</h2>
        <p className="mt-2 text-[15px] muted">Your scores show where you are. Who's behind the wheel is where you claim who you are, and how big a change you are making. Your scores do not decide it.</p>
      </a>


      </>
      )}
    </>
  );
}
