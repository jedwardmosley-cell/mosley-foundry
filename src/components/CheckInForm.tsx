import { logCheckIn } from "@/app/actions/participant";
import { Submit } from "./Submit";
import { TagChoices } from "./Picks";
import { CHECKIN_TAGS } from "@/content/options";
import { CHECKIN_IDENTITY } from "@/content/identity";
import Link from "next/link";
import type { PillarKey } from "@/content/types";
import { PillarMark } from "./ui";

/** One focus in today's check-in. With two focuses, each gets its own Done / Partial / Not yet, with equal weight. */
export type CheckInFocus = { slot: 1 | 2; id: string; title: string; plan: string; day: number; pillar: string; status: string };

type Existing = { status: string; note: string; reflection: string; shared: boolean; tags: string; identityActed: string; identityNote: string } | null;

const OPTIONS = [
  { v: "DONE", label: "Done" },
  { v: "PARTIAL", label: "Partial" },
  { v: "NOT_YET", label: "Not yet" },
];

/**
 * The daily check-in: a few taps, one save for the day. Each focus gets its own answer; the identity question
 * and the detail are asked once, for the day. Works without JavaScript.
 */
/** `chapter`: set like a page of the book. The answers are words on the page, underlined when chosen. */
export function CheckInForm({ existing, hasCoach, identityLevel, dark = false, chapter = false, focuses, lines }: { existing: Existing; hasCoach: boolean; identityLevel?: string | null; dark?: boolean; chapter?: boolean; focuses: CheckInFocus[]; lines?: Record<string, React.ReactNode> }) {
  const two = focuses.length > 1;
  const pill = dark
    ? "border border-white/30 bg-surface/5 text-white peer-checked:bg-surface peer-checked:text-heading peer-checked:border-white"
    : "bg-ink/[0.05] text-ink-soft peer-checked:bg-navy peer-checked:text-white";
  return (
    <form action={logCheckIn} className="space-y-4">
      {focuses.map((f) => (
        <fieldset key={f.slot}>
          <legend className={two ? "mb-3 flex w-full items-start gap-2.5" : "sr-only"}>
            {two ? (
              <>
                <PillarMark k={f.pillar as PillarKey} size="sm" />
                <span className="min-w-0 flex-1">
                  <Link href={`/cycle?id=${f.id}`} className="block text-[15px] font-medium leading-snug text-heading hover:text-link">{f.title}</Link>
                  <span className="block text-[13px] text-ink-mute">Day {f.day} of 30</span>
                  {lines?.[f.id] && <span className="mt-2 block">{lines[f.id]}</span>}
                </span>
              </>
            ) : "Did you practice today?"}
          </legend>
          <div className={chapter ? "flex justify-between gap-3" : "seg grid-cols-3"}>
            {OPTIONS.map((o) => (
              <label key={o.v} className="cursor-pointer">
                <input type="radio" name={f.slot === 2 ? "status2" : "status"} value={o.v} defaultChecked={f.status === o.v} required className="peer sr-only" />
                <span className={chapter
                  ? "block font-book text-[22px] leading-tight pb-1 border-b-2 border-ink/15 text-ink-soft transition hover:text-heading peer-checked:border-gold peer-checked:text-heading peer-focus-visible:ring-4 peer-focus-visible:ring-navy/20"
                  : "seg-opt hover:text-heading peer-checked:bg-surface peer-checked:text-heading peer-checked:shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_14px_-8px_rgb(0_0_0/0.3)] peer-focus-visible:ring-4 peer-focus-visible:ring-navy/20"}>
                  {o.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {identityLevel && (
        <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <legend className={`sr-only`}>{CHECKIN_IDENTITY.question}</legend>
          <span aria-hidden className={chapter ? "font-book italic text-[17px] text-ink-soft" : `text-sm ${dark ? "text-white/80" : "text-ink-soft"}`}>Showed up as who I am?</span>
          {(Object.entries(CHECKIN_IDENTITY.answers) as [string, string][]).map(([v, label]) => (
            <label key={v} className="cursor-pointer">
              <input type="radio" name="identityActed" value={v} defaultChecked={existing?.identityActed === v} className="peer sr-only" />
              <span className={chapter ? "block font-book text-[17px] px-1 pb-0.5 border-b border-ink/15 text-ink-soft transition peer-checked:border-gold peer-checked:text-heading peer-focus-visible:ring-4 peer-focus-visible:ring-navy/20" : `block rounded-full px-3 py-1.5 text-[13px] transition peer-focus-visible:ring-4 peer-focus-visible:ring-navy/20 ${pill}`}>{label}</span>
            </label>
          ))}
        </fieldset>
      )}
      {<details className={`rounded-2xl ${dark ? "bg-surface/5" : ""} px-1 py-1`} open={!!(existing?.note || existing?.reflection || existing?.identityNote)}>
        <summary className={chapter ? "cursor-pointer font-book italic text-[16px] text-ink-soft" : `cursor-pointer text-sm ${dark ? "text-white/80" : "text-link"}`}>Add detail</summary>
        <div className={`mt-3 space-y-3 text-ink`}>
          <TagChoices name="tags" list={CHECKIN_TAGS} legend="Where?" selected={existing ? (JSON.parse(existing.tags || "[]") as string[]) : []} />
          <input name="note" aria-label="Note" defaultValue={existing?.note} className="input" maxLength={1000} placeholder="One line: what happened" />
          <textarea name="reflection" aria-label="Reflection" defaultValue={existing?.reflection} className="textarea !min-h-[64px]" maxLength={3000} placeholder="What did today show you?" />
          {identityLevel && (
            <input name="identityNote" aria-label={identityLevel === "REINVENT" ? CHECKIN_IDENTITY.level3 : CHECKIN_IDENTITY.followUp} defaultValue={existing?.identityNote} maxLength={500} className="input"
              placeholder={identityLevel === "REINVENT" ? CHECKIN_IDENTITY.level3 : CHECKIN_IDENTITY.followUp} />
          )}
          {hasCoach && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="shared" defaultChecked={existing?.shared} className="h-4 w-4 accent-navy" />
              Share these words with my coach
            </label>
          )}
        </div>
      </details>}
      <Submit className={dark ? "btn w-full bg-surface text-heading" : "btn-primary w-full"}>{focuses.some((f) => f.status) ? "Update my daily check-in" : "Save my daily check-in"}</Submit>
    </form>
  );
}
