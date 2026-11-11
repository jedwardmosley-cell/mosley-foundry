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
export function CheckInForm({ existing, hasCoach, identityLevel }: { existing: Existing; hasCoach: boolean; identityLevel?: string | null }) {
  return (
    <form action={logCheckIn} className="space-y-4">
      <fieldset>
        <legend className="label">Did you practice today?</legend>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map((o) => (
            <label key={o.v} className="cursor-pointer">
              <input type="radio" name="status" value={o.v} defaultChecked={existing?.status === o.v} required className="peer sr-only" />
              <span className="block rounded-xl border border-line bg-white py-2.5 text-center text-[15px] peer-checked:bg-navy peer-checked:text-white peer-checked:border-navy peer-focus-visible:ring-2 peer-focus-visible:ring-navy/40">
                {o.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <TagChoices name="tags" list={CHECKIN_TAGS} legend="Where did it show up?" selected={existing ? (JSON.parse(existing.tags || "[]") as string[]) : []} />
      {identityLevel && (
        <fieldset>
          <legend className="label">{CHECKIN_IDENTITY.question} <span className="text-ink-mute font-normal">(optional)</span></legend>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(CHECKIN_IDENTITY.answers) as [string, string][]).map(([v, label]) => (
              <label key={v} className="cursor-pointer">
                <input type="radio" name="identityActed" value={v} defaultChecked={existing?.identityActed === v} className="peer sr-only" />
                <span className="block rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] text-ink-soft peer-checked:bg-navy peer-checked:text-white peer-checked:border-navy peer-focus-visible:ring-2 peer-focus-visible:ring-navy/40">{label}</span>
              </label>
            ))}
          </div>
          <details className="mt-2" open={!!existing?.identityNote}>
            <summary className="cursor-pointer text-sm text-navy">{identityLevel === "REINVENT" ? CHECKIN_IDENTITY.level3 : CHECKIN_IDENTITY.followUp}</summary>
            <input name="identityNote" aria-label={identityLevel === "REINVENT" ? CHECKIN_IDENTITY.level3 : CHECKIN_IDENTITY.followUp} defaultValue={existing?.identityNote} maxLength={500} className="input mt-2" placeholder="One line is enough" />
          </details>
        </fieldset>
      )}
      <details className="group" open={!!(existing?.note || existing?.reflection)}>
        <summary className="cursor-pointer text-sm text-navy">Add a note or reflection</summary>
        <input name="note" defaultValue={existing?.note} className="input mt-2" maxLength={1000} placeholder="One line: the moment, what you did, what changed" />
        <textarea name="reflection" defaultValue={existing?.reflection} className="textarea mt-2" maxLength={3000} placeholder="What did today show you?" />
      </details>
      {hasCoach && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="shared" defaultChecked={existing?.shared} className="h-4 w-4 accent-navy" />
          Share this entry's words with my coach (only if I have turned on reflection sharing)
        </label>
      )}
      <Submit>{existing ? "Update today" : "Log today"}</Submit>
    </form>
  );
}
