import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getContent } from "@/content";
import { fmt } from "@/lib/dates";
import { FEEDBACK_SOURCES, FEEDBACK_COPY } from "@/content/feedback";
import { addEqi, updateEqi, approveEqiInterpretation, deleteEqi, addEqiToBlueprint, shareEqi } from "@/app/actions/participant";
import { setFeedbackShare, setFeedbackAi, removeFeedbackFile, deleteFeedback } from "@/app/actions/feedback";
import type { PillarKey } from "@/content/types";
import { PageHeader, Card, Field, PillarMark } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { FeedbackForm } from "@/components/FeedbackForm";

export const metadata = { title: "My feedback" };

/** A switch that posts one form: on or off. */
function Switch({ action, id, on, label, note, disabled }: { action: (fd: FormData) => Promise<void>; id: string; on: boolean; label: string; note?: string; disabled?: string }) {
  return (
    <form action={action} className="flex items-center justify-between gap-4 border-t border-line/70 py-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="on" value={on ? "false" : "true"} />
      <span className="text-[15px]">{label}{(note || disabled) && <span className="block text-xs text-ink-mute">{disabled ?? note}</span>}</span>
      <button disabled={!!disabled} role="switch" aria-checked={on} aria-label={label} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-navy" : "bg-ink/15"} disabled:opacity-40`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </form>
  );
}

export default async function FeedbackEntry({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { id } = await params;
  const { edit } = await searchParams;
  const f = await db.feedback.findFirst({
    where: { id, userId: u.id },
    select: { id: true, source: true, title: true, takenOn: true, summary: true, pillars: true, shareCoach: true, allowAi: true, fileName: true, fileSize: true, priorities: { orderBy: { createdAt: "asc" } } },
  });
  if (!f) notFound();
  const { pack } = await getContent();
  const [coaches, eqiGrant, profile] = await Promise.all([
    db.coachAssignment.findMany({ where: { participantId: u.id, active: true }, include: { coach: { select: { name: true } } } }),
    db.shareGrant.findFirst({ where: { ownerId: u.id, scope: "EQI" } }),
    db.profile.findUnique({ where: { userId: u.id }, select: { aiEnabled: true } }),
  ]);
  const pillars = JSON.parse(f.pillars || "[]") as PillarKey[];
  const pillarNames = Object.fromEntries(pack.pillars.map((p) => [p.key, p.name]));
  const coachName = coaches[0]?.coach.name.split(" (")[0];
  const PillarSelect = ({ value }: { value?: string | null }) => (
    <select name="pillar" defaultValue={value ?? ""} className="input">
      <option value="">Choose a pillar</option>
      {pack.pillars.map((p) => <option key={p.key} value={p.key}>{p.name}: {p.short}</option>)}
    </select>
  );

  if (edit) {
    return (
      <>
        <Link href={`/feedback/${f.id}`} className="text-sm btn-link">Back to {f.title}</Link>
        <PageHeader title="Edit feedback" />
        <Card>
          <FeedbackForm pillarNames={pillarNames} initial={{ id: f.id, source: f.source, title: f.title, summary: f.summary, pillars, fileName: f.fileName, takenOn: f.takenOn ? `${f.takenOn.getFullYear()}-${String(f.takenOn.getMonth() + 1).padStart(2, "0")}` : "" }} />
        </Card>
      </>
    );
  }

  return (
    <>
      <Link href="/feedback" className="text-sm btn-link">My feedback</Link>
      <PageHeader title={f.title}>
        {FEEDBACK_SOURCES[f.source as keyof typeof FEEDBACK_SOURCES] ?? f.source}{f.takenOn ? ` · ${fmt(f.takenOn, { month: "long", year: "numeric" })}` : ""} · {f.shareCoach ? "Shared with my coach" : "Private"}
      </PageHeader>

      <Card>
        {f.summary ? <p className="whitespace-pre-line font-serif text-[18px] leading-[1.55] text-heading">{f.summary}</p> : <p className="text-[15px] text-ink-mute">No summary yet.</p>}
        {f.fileName && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-ink/[0.04] px-4 py-3 text-sm">
            <a href={`/feedback/${f.id}/file`} target="_blank" rel="noopener" className="btn-link">{f.fileName}</a>
            <span className="text-ink-mute">{f.fileSize ? `${Math.max(1, Math.round(f.fileSize / 1024))} KB` : ""}</span>
            <form action={removeFeedbackFile} className="ml-auto"><input type="hidden" name="id" value={f.id} /><button className="text-ink-mute hover:text-alert">Remove file</button></form>
          </div>
        )}
        {pillars.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-soft">Speaks to {pillars.map((k) => <span key={k} className="inline-flex items-center gap-1.5"><PillarMark k={k} size="sm" />{pillarNames[k]}</span>)}</div>
        )}
        <Link href={`/feedback/${f.id}?edit=1`} className="mt-4 inline-block text-sm btn-link">Edit</Link>
      </Card>

      <h2 className="h2 mt-10 mb-4">What I&apos;m working on from this</h2>
      <div className="space-y-3">
        {f.priorities.map((e) => {
          const shared = e.participantApproved && !!eqiGrant;
          const pillarName = e.pillar ? pillarNames[e.pillar] : "";
          return (
            <Card key={e.id} className="!py-5">
              <div className="flex items-start gap-3">
                {e.pillar ? <PillarMark k={e.pillar as PillarKey} size="sm" /> : <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-ink/25" />}
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16px] font-medium leading-snug text-heading">{e.label}</h3>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {pillarName || "No pillar yet"} · {e.practice ? <>Practice: {e.practice}</> : "No practice yet"}
                    {shared && <> · <span className="text-ink-mute">Shared with my coach</span></>}
                  </p>
                </div>
              </div>
              {e.note && <p className="mt-3 text-[15px]">{e.note}</p>}

              {/* The three ways to put it to work, on one row. */}
              <div className="mt-4 flex flex-wrap gap-2">
                {e.pillar && <Link href={`/cycle/new?pillar=${e.pillar}&focus=${encodeURIComponent(e.practice || e.label)}`} className="btn-quiet !px-4 !py-2 text-sm">Practice this for 30 days</Link>}
                {e.practice && <form action={addEqiToBlueprint}><input type="hidden" name="id" value={e.id} /><button className="btn-quiet !px-4 !py-2 text-sm">Add to My road</button></form>}
                {coaches.length > 0 && !shared && <form action={shareEqi}><input type="hidden" name="id" value={e.id} /><button className="btn-quiet !px-4 !py-2 text-sm">Share with {coachName}</button></form>}
              </div>

              {e.coachInterpretation && (
                <div className="mt-4 rounded-2xl bg-ink/[0.04] p-4">
                  <p className="text-xs text-ink-mute">Your coach wrote this after your debrief</p>
                  <p className="mt-1 text-[15px]">{e.coachInterpretation}</p>
                  {!e.participantApproved && (
                    <form action={approveEqiInterpretation} className="mt-2">
                      <input type="hidden" name="id" value={e.id} /><input type="hidden" name="approved" value="true" />
                      <button className="btn-link text-sm">This looks right. Share it with my coach again</button>
                    </form>
                  )}
                </div>
              )}

              <details className="mt-3 text-sm" open={!e.pillar || !e.practice}>
                <summary className="cursor-pointer font-medium text-link">{!e.pillar || !e.practice ? "Add a pillar and a practice" : "Edit"}</summary>
                <form action={updateEqi} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={e.id} />
                  <Field label="FORGE pillar this connects to" hint="Your call. Pick the pillar where this shows up most."><PillarSelect value={e.pillar} /></Field>
                  <Field label="Practice I will try"><input name="practice" defaultValue={e.practice} maxLength={1500} className="input" placeholder="One small thing you could do" /></Field>
                  <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                    <Submit className="btn-quiet">Save</Submit>
                    {shared && <button formAction={approveEqiInterpretation} name="approved" value="false" className="btn-link">Stop sharing this one</button>}
                  </div>
                </form>
                <form action={deleteEqi} className="mt-2"><input type="hidden" name="id" value={e.id} /><button className="text-ink-mute hover:text-alert">Remove</button></form>
              </details>
            </Card>
          );
        })}
        <details className="card !py-5" open={f.priorities.length === 0}>
          <summary className="cursor-pointer text-[16px] font-medium text-link">Add something I&apos;m working on</summary>
          <form action={addEqi} className="mt-4 space-y-3">
            <input type="hidden" name="feedbackId" value={f.id} />
            <Field label="What I'm working on" hint="Your own words. For example: Speaking up for what my team needs"><input name="label" required maxLength={200} className="input" /></Field>
            <Field label="FORGE pillar this connects to"><PillarSelect /></Field>
            <Field label="Practice I will try (optional)"><input name="practice" maxLength={1500} className="input" /></Field>
            <Submit>Add</Submit>
          </form>
        </details>
      </div>

      <section className="mt-10">
        <h2 className="h2 mb-2">Who can see this</h2>
        <Switch action={setFeedbackShare} id={f.id} on={f.shareCoach} label={FEEDBACK_COPY.shareCoach} disabled={!coaches.length && !f.shareCoach ? "You don't have a coach yet." : undefined} note={coachName ? `${coachName} sees the summary, the file and the pillars.` : undefined} />
        <Switch action={setFeedbackAi} id={f.id} on={f.allowAi} label={FEEDBACK_COPY.allowAi} note={FEEDBACK_COPY.aiNote} disabled={profile?.aiEnabled === false ? "You turned the AI companion off in Settings." : undefined} />
      </section>

      <form action={deleteFeedback} className="mt-10"><input type="hidden" name="id" value={f.id} /><button className="text-sm text-ink-mute hover:text-alert">Delete this feedback and its file</button></form>
    </>
  );
}
