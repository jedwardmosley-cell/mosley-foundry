import { db } from "@/lib/db";
import { editionOf } from "@/lib/edition";
import { answerPartner } from "@/app/actions/partner";
import { Submit } from "@/components/Submit";
import { PARTNER_WORDS, RULE_ORDER, partnerQuestion } from "@/lib/distance";
import { firstName } from "@/lib/distanceReport";

export const metadata = { title: "An honest view", robots: { index: false, follow: false } };

/**
 * The page an accountability partner opens from the text message. No account needed.
 * They see the person's five lines, nothing else, and answer one question for each.
 */
export default async function PartnerView({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ thanks?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const ask = await db.distancePartner.findUnique({
    where: { token },
    select: { status: true, run: { select: { user: { select: { name: true, edition: true } }, rules: { select: { pillar: true, line: true } } } } },
  });
  const run = ask?.run;
  const book = editionOf(run?.user.edition);
  const name = firstName(run?.user.name ?? "");
  const open = ask?.status === "SENT";

  return (
    <main className={`${book.className} min-h-screen bg-paper px-4 py-10`}>
      <div className="mx-auto max-w-xl">
        <p className="eyebrow">{book.name}</p>
        {sp.thanks || ask?.status === "ANSWERED" ? (
          <>
            <h1 className="mt-2 font-book text-[30px] leading-tight text-heading">Thank you. Your answers are in.</h1>
            <p className="mt-3 text-[16px] text-ink-soft">{name ? `${name} will see them in the app.` : "They'll see them in the app."} You can close this page.</p>
          </>
        ) : !open ? (
          <p className="mt-3 text-[16px]">This link isn&apos;t active.</p>
        ) : (
          <>
            <h1 className="mt-2 font-book text-[30px] leading-tight text-heading text-balance">{name} asked for your honest view</h1>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
              {name} wrote five lines about the person they&apos;re becoming. For each one, say how often {name} looks like that person today. There are no right answers, and it takes about two minutes. Your answers go to {name}.
            </p>
            <form action={answerPartner} className="mt-8 space-y-6">
              <input type="hidden" name="token" value={token} />
              {RULE_ORDER.map((k, i) => {
                const line = run!.rules.find((r) => r.pillar === k)?.line ?? "";
                return (
                  <fieldset key={k} className="rounded-2xl border border-line/70 bg-card px-5 py-5">
                    <legend className="sr-only">Line {i + 1}: {line}</legend>
                    <p className="font-serif text-[19px] leading-snug text-heading">{line}</p>
                    <p className="mt-3 text-[15px] text-ink-soft">{partnerQuestion(name)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {PARTNER_WORDS.map((w, j) => (
                        <label key={w} className="flex cursor-pointer items-center justify-center rounded-xl border border-line/70 bg-paper px-3 py-2.5 text-center text-[15px] text-ink transition hover:border-ink/25 has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-paper has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-navy/20">
                          <input type="radio" name={k} value={j + 1} required className="sr-only" />
                          {w}
                        </label>
                      ))}
                    </div>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-ink-soft">Add an example (optional)</summary>
                      <textarea name={`ex${k}`} maxLength={600} rows={3} className="textarea mt-2" placeholder={`A time you saw it, or didn't.`} />
                    </details>
                  </fieldset>
                );
              })}
              <Submit className="btn-primary">Send my answers</Submit>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
