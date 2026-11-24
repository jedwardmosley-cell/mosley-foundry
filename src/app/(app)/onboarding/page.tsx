import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PATHWAYS } from "@/content/program";
import { choosePathway } from "@/app/actions/participant";
import { PageHeader } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { RenewalCode } from "@/components/RenewalCode";
import { EDITIONS } from "@/lib/edition";

export const metadata = { title: "Choose your program" };

/**
 * Getting started, in two steps. First the book: Both Hands on the Wheel, or The Road to Renewal with a code.
 * Then the program (Personal, Leading Others, Entrepreneurial). Someone already set up who comes back to
 * change their program goes straight to the second step.
 */
export default async function Onboarding({ searchParams }: { searchParams: Promise<{ code?: string; book?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const sp = await searchParams;
  const first = u.name.split(" ")[0];
  const settingUp = !(await db.profile.findUnique({ where: { userId: u.id }, select: { onboardedAt: true } }))?.onboardedAt;
  const bookChosen = u.edition === "RENEWAL" || sp.book === "both" || !settingUp;

  if (!bookChosen) {
    const b = EDITIONS.BOTH_HANDS;
    return (
      <>
        <PageHeader eyebrow="Getting in the Driver's Seat" title={`Welcome, ${first}. Which book are you working from?`}>
          The app is built on one of two books. Pick yours, then choose your program.
        </PageHeader>
        <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
          <section id="both-hands" className="overflow-hidden rounded-2xl border border-line/70 bg-card">
            <div className="aspect-[16/7] bg-cover bg-[center_75%]" style={{ backgroundImage: "url(/editions/both-hands-road.jpg)" }} role="img" aria-label="Both hands on the wheel, driving toward a city at sunrise" />
            <div className="px-5 py-5 sm:px-7">
              <h2 className="font-book text-[26px] leading-tight text-heading">{b.name}</h2>
              <p className="mt-1 font-book italic text-[17px] text-ink-soft">Five Rules for the road ahead</p>
              <p className="mt-3 text-[15px] text-ink-soft">Who you are behind the wheel, and the system that keeps you there.</p>
              <Link href="/onboarding?book=both" className="btn-primary mt-4 inline-block">Start with this book</Link>
            </div>
          </section>
          <RenewalCode edition={u.edition} back="onboarding" note={sp.code} />
        </div>
        <p className="mt-8 text-sm muted max-w-2xl">
          This is a leadership development experience, not therapy. You choose how much to disclose. Your reflections and journal are private unless you decide to share specific items with your coach.
        </p>
      </>
    );
  }

  const book = u.edition === "RENEWAL" ? EDITIONS.RENEWAL : EDITIONS.BOTH_HANDS;
  return (
    <>
      <PageHeader eyebrow={book.name} title={`Which program are you in, ${first}?`}>
        This sets which program materials you see. Next, you&apos;ll name the seat you&apos;re in. You can change the program later.
      </PageHeader>
      {sp.code === "ok" && <p role="status" className="notice mb-5">You&apos;re in The Road to Renewal. Welcome. Now choose your program.</p>}
      <div className="grid gap-4">
        {Object.values(PATHWAYS).map((p) => (
          <form key={p.key} action={choosePathway} className="card flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <input type="hidden" name="pathway" value={p.key} />
            <div>
              <h2 className="h2">{p.name}</h2>
              <p className="muted mt-1 text-[15px]">{p.line}</p>
            </div>
            <Submit className="btn-primary shrink-0">Choose</Submit>
          </form>
        ))}
      </div>
      {settingUp && u.edition !== "RENEWAL" && <p className="mt-6 text-sm"><Link href="/onboarding" className="btn-link">Back to choosing the book</Link></p>}
      <p className="mt-8 text-sm muted max-w-2xl">
        This is a leadership development experience, not therapy. You choose how much to disclose. Your reflections and journal are private unless you decide to share specific items with your coach.
      </p>
    </>
  );
}
