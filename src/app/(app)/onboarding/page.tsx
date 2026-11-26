import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PATHWAYS } from "@/content/program";
import { choosePathway } from "@/app/actions/participant";
import { PageHeader } from "@/components/ui";
import { Submit } from "@/components/Submit";
import { BookCard } from "@/components/BookChoice";
import { EDITIONS } from "@/lib/edition";

export const metadata = { title: "Choose your program" };

/**
 * Getting started, in two steps. First the book: Both Hands on the Wheel or The Road to Renewal.
 * Then the program (Personal, Leading Others, Entrepreneurial). Someone already set up who comes back to
 * change their program goes straight to the second step.
 */
export default async function Onboarding({ searchParams }: { searchParams: Promise<{ book?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const sp = await searchParams;
  const first = u.name.split(" ")[0];
  const settingUp = !(await db.profile.findUnique({ where: { userId: u.id }, select: { onboardedAt: true } }))?.onboardedAt;
  const bookChosen = !!sp.book || !settingUp;

  if (!bookChosen) {
    return (
      <>
        <PageHeader eyebrow="Getting in the Driver's Seat" title={`Welcome, ${first}. Which book are you working from?`}>
          The app is built on one of two books. Pick yours, then choose your program.
        </PageHeader>
        <div className="grid gap-5 sm:grid-cols-2">
          <BookCard book="BOTH_HANDS" back="onboarding" />
          <BookCard book="RENEWAL" back="onboarding" />
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
      {sp.book === "renewal" && <p role="status" className="notice mb-5">You&apos;re in The Road to Renewal. Welcome. Now choose your program.</p>}
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
      {settingUp && <p className="mt-6 text-sm"><Link href="/onboarding" className="btn-link">Back to choosing the book</Link></p>}
      <p className="mt-8 text-sm muted max-w-2xl">
        This is a leadership development experience, not therapy. You choose how much to disclose. Your reflections and journal are private unless you decide to share specific items with your coach.
      </p>
    </>
  );
}
