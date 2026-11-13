import { logCheckIn } from "@/app/actions/participant";
import { Submit } from "./Submit";
import { TagChoices } from "./Picks";
import { CHECKIN_TAGS } from "@/content/options";
import { CHECKIN_IDENTITY } from "@/content/identity";

type Existing = { status: string; note: string; reflection: string; shared: boolean; tags: string; identityActed: string; identityNote: string } | null;

const OPTIONS = [
  { v: "DONE", label: "Done" },
  { v: "PARTIAL", label: "Partial" },
  { v: "NOT_YET", label: "Not yet" },
];

/** Two-minute daily check-in. Works without JavaScript. */
export function CheckInForm({ existing, hasCoach, identityLevel, dark = false }: { existing: Existing; hasCoach: boolean; identityLevel?: string | null; dark?: boolean }) {
  const pill = dark
    ? "border-white/30 bg-surface/5 text-white peer-checked:bg-surface peer-checked:text-heading peer-checked:border-white"
    : "border-line bg-surface peer-checked:bg-navy peer-checked:text-white peer-checked:border-navy";
  return (
    <form action={logCheckIn} className="space-y-4">
      <fieldset>
        <legend className="sr-only">Did you practice today?</legend>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map((o) => (
            <label key={o.v} className="cursor-pointer">
              <input type="radio" name="status" value={o.v} defaultChecked={existing?.status === o.v} required className="peer sr-only" />
              <span className={`block rounded-xl border py-3.5 text-center text-base font-medium peer-focus-visible:ring-2 peer-focus-visible:ring-brass ${pill}`}>
                {o.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {identityLevel && (
        <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <legend className={`sr-only`}>{CHECKIN_IDENTITY.question}</legend>
          <span aria-hidden className={`text-sm ${dark ? "text-white/80" : "text-ink-soft"}`}>Showed up as who I am?</span>
          {(Object.entries(CHECKIN_IDENTITY.answers) as [string, string][]).map(([v, label]) => (
            <label key={v} className="cursor-pointer">
              <input type="radio" name="identityActed" value={v} defaultChecked={existing?.identityActed === v} className="peer sr-only" />
              <span className={`block rounded-full border px-3 py-1 text-[13px] peer-focus-visible:ring-2 peer-focus-visible:ring-brass ${pill}`}>{label}</span>
            </label>
          ))}
        </fieldset>
      )}
      <details className={`rounded-xl ${dark ? "bg-surface/5" : "bg-paper"} px-3 py-2`} open={!!(existing?.note || existing?.reflection || existing?.identityNote)}>
        <summary className={`cursor-pointer text-sm ${dark ? "text-white/80" : "text-link"}`}>Add detail</summary>
        <div className={`mt-3 space-y-3 rounded-xl bg-surface p-3 text-ink`}>
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
      </details>
      <Submit className={dark ? "btn w-full bg-brass text-heading hover:bg-surface" : "btn-primary w-full"}>{existing ? "Update today" : "Log today"}</Submit>
    </form>
  );
}
