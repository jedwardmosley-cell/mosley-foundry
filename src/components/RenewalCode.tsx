import { redeemAccessCode } from "@/app/actions/participant";
import { EDITIONS } from "@/lib/edition";
import { Submit } from "./Submit";

const NOTE: Record<string, string> = {
  ok: "You're in The Road to Renewal. Welcome.",
  unknown: "That code didn't match. Check it with whoever gave it to you.",
  off: "That code has been turned off. Ask whoever gave it to you for a new one.",
  expired: "That code has ended. Ask whoever gave it to you for a new one.",
  full: "That code has been used as many times as it allows. Ask for a new one.",
  wait: "Too many tries. Wait 15 minutes and try again.",
};

/** The Road to Renewal: the cover's road, the name, and a box for the access code. */
export function RenewalCode({ edition, back, note }: { edition: string; back: "onboarding" | "settings"; note?: string }) {
  const r = EDITIONS.RENEWAL;
  const inIt = edition === "RENEWAL";
  return (
    <section id="renewal" className="scroll-mt-24 overflow-hidden rounded-2xl border border-line/70 bg-card">
      <div className="aspect-[16/7] bg-cover bg-center" style={{ backgroundImage: "url(/editions/renewal-road.jpg)" }} role="img" aria-label="A road running toward a mountain at sunrise" />
      <div className="px-5 py-5 sm:px-7">
        <h2 className="font-book text-[26px] leading-tight text-heading">{r.name}</h2>
        <p className="mt-1 font-book italic text-[17px] text-ink-soft">{r.tagline}</p>
        {note && NOTE[note] && <p role="status" className="notice mt-3">{NOTE[note]}</p>}
        {inIt ? (
          <p className="mt-3 text-[15px] text-ink-soft">This is your edition. The app is built on The Road to Renewal.</p>
        ) : (
          <>
            <p className="mt-3 text-[15px] text-ink-soft">The same app, built on The Road to Renewal. It opens with a code from your church, group or coach.</p>
            <form action={redeemAccessCode} className="mt-4 flex flex-wrap gap-2">
              <input type="hidden" name="back" value={back} />
              <label className="sr-only" htmlFor={`code-${back}`}>Access code</label>
              <input id={`code-${back}`} name="code" required maxLength={64} autoComplete="off" autoCapitalize="characters" placeholder="Your code" className="input !w-auto min-w-0 flex-1 uppercase" />
              <Submit className="btn-primary shrink-0">Open it</Submit>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
