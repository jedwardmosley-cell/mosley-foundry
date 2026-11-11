import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIdentity, removeIdentity } from "@/app/actions/identity";
import { LEVELS, QUESTIONS, PATHWAY_CONTEXT, FIRST_EXAMPLE, NO_RANK_NOTE, type IdentityLevel } from "@/content/identity";
import type { PathwayKey } from "@/content/program";
import { fmt } from "@/lib/dates";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { DictationHint } from "@/components/Picks";
import { IdentitySpectrum } from "@/components/IdentitySpectrum";

export const metadata = { title: "Identity Shift" };

export default async function IdentityPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { saved } = await searchParams;
  const [profile, id, history] = await Promise.all([
    db.profile.findUnique({ where: { userId: u.id } }),
    db.identityProfile.findUnique({ where: { userId: u.id } }),
    db.identityHistory.findMany({ where: { userId: u.id }, orderBy: { endedAt: "desc" }, take: 10 }),
  ]);
  const pathway = (profile?.pathway ?? "PERSONAL") as PathwayKey;

  return (
    <>
      <PageHeader eyebrow="Optional" title="Identity Shift Spectrum">
        People are not always trying to make the same size of change. Some want to strengthen who they are. Others are stepping into a new role. Others want to reinvent how they show up. Tell the app which one fits you, and the coaching adjusts. Your FORGE scores and plan stay as they are.
      </PageHeader>

      {saved && <p role="status" className="mb-4 rounded-xl border border-sage/40 bg-sage-soft px-4 py-2.5 text-sm text-sage">Saved. <Link href="/dashboard" className="underline">See it on your Today screen</Link>.</p>}

      <Card>
        <form action={saveIdentity} className="space-y-6">
          <Field label={`1. ${QUESTIONS.becoming}`} hint="One or two sentences. Describe the person, in the present tense if you can.">
            <textarea name="becoming" required defaultValue={id?.becoming} maxLength={1500} className="textarea !min-h-[72px]" />
          </Field>
          <Field label={`2. ${QUESTIONS.situation}`}>
            <textarea name="situation" defaultValue={id?.situation} maxLength={1500} className="textarea !min-h-[64px]" />
          </Field>
          <Field label={`3. ${QUESTIONS.behavior}`} hint="Something another person could see you do.">
            <textarea name="behavior" defaultValue={id?.behavior} maxLength={1500} className="textarea !min-h-[64px]" />
          </Field>
          <DictationHint />

          <fieldset>
            <legend className="label">4. {QUESTIONS.level}</legend>
            <p className="text-sm text-ink-soft mb-3">{PATHWAY_CONTEXT[pathway]}</p>
            <IdentitySpectrum
              initial={id?.level as IdentityLevel | undefined}
              firstExample={FIRST_EXAMPLE[pathway]}
              persona={{ personaName: id?.personaName, personaQualities: id?.personaQualities, personaStandards: id?.personaStandards, personaSituations: id?.personaSituations, personaCue: id?.personaCue, personaBehaviors: id?.personaBehaviors }}
            />
            <p className="mt-4 text-xs text-ink-mute">{NO_RANK_NOTE} The choice is yours. The app never picks a level from your FORGE scores, and you can change it later without losing anything.</p>
          </fieldset>

          <Submit>{id ? "Save changes" : "Save my identity shift"}</Submit>
        </form>
      </Card>

      {history.length > 0 && (
        <Card className="mt-6">
          <p className="eyebrow">Earlier versions</p>
          <ul className="mt-2 divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="py-2.5">
                <p className="text-xs text-ink-mute">{fmt(h.startedAt, { month: "short", day: "numeric", year: "numeric" })} to {fmt(h.endedAt, { month: "short", day: "numeric", year: "numeric" })} · {LEVELS[h.level as IdentityLevel]?.name}{h.personaName ? ` · ${h.personaName}` : ""}</p>
                <p className="text-[15px]">{h.becoming}</p>
                {h.behavior && <p className="text-sm text-ink-soft">Behavior: {h.behavior}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {id && (
        <form action={removeIdentity} className="mt-6">
          <button className="text-sm text-ink-mute hover:text-ink">Turn off the Identity Shift section. Your current version is saved under Earlier versions.</button>
        </form>
      )}
    </>
  );
}
