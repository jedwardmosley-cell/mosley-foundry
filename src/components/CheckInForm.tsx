import { logCheckIn } from "@/app/actions/participant";
import { Submit } from "./Submit";

type Existing = { status: string; note: string; reflection: string; shared: boolean } | null;

const OPTIONS = [
  { v: "DONE", label: "Done" },
  { v: "PARTIAL", label: "Partial" },
  { v: "NOT_YET", label: "Not yet" },
];

/** Two-minute daily check-in. Works without JavaScript. */
export function CheckInForm({ existing, hasCoach }: { existing: Existing; hasCoach: boolean }) {
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
      <label className="block">
        <span className="label">What happened? <span className="text-ink-mute font-normal">(one line, optional)</span></span>
        <input name="note" defaultValue={existing?.note} className="input" maxLength={1000} placeholder="The moment, what you did, what changed" />
      </label>
      <details className="group" open={!!existing?.reflection}>
        <summary className="cursor-pointer text-sm text-navy">Add a reflection</summary>
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
