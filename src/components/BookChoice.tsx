import { chooseBook } from "@/app/actions/participant";
import { EDITIONS } from "@/lib/edition";
import { Submit } from "./Submit";

/** The two books, each with its cover art (no words on the picture) and its own subtitle. */
const BOOKS = [
  { key: "BOTH_HANDS", id: "both-hands", image: "/editions/both-hands-road.jpg", position: "bg-[center_75%]", alt: "Both hands on the wheel, driving toward a city at sunrise", subtitle: "Five Rules for the road ahead", line: "Who you are behind the wheel, and the system that keeps you there." },
  { key: "RENEWAL", id: "renewal", image: "/editions/renewal-road.jpg", position: "bg-center", alt: "A road running toward a mountain at sunrise", subtitle: EDITIONS.RENEWAL.tagline, line: "The same app, built on The Road to Renewal, with a verse and a prayer for each part of the journey." },
] as const;

/** One book's card with its button. */
export function BookCard({ book, back, current }: { book: "BOTH_HANDS" | "RENEWAL"; back: "onboarding" | "settings"; current?: boolean }) {
  const b = BOOKS.find((x) => x.key === book)!;
  return (
    <section id={b.id} className="overflow-hidden rounded-2xl border border-line/70 bg-card">
      <div className={`aspect-[16/7] bg-cover ${b.position}`} style={{ backgroundImage: `url(${b.image})` }} role="img" aria-label={b.alt} />
      <div className="px-5 py-5 sm:px-7">
        <h2 className="font-book text-[26px] leading-tight text-heading">{EDITIONS[book].name}</h2>
        <p className="mt-1 font-book italic text-[17px] text-ink-soft">{b.subtitle}</p>
        <p className="mt-3 text-[15px] text-ink-soft">{b.line}</p>
        {current ? (
          <p className="mt-4 text-sm font-semibold text-heading">Your book</p>
        ) : (
          <form action={chooseBook} className="mt-4">
            <input type="hidden" name="book" value={book} />
            <input type="hidden" name="back" value={back} />
            <Submit className="btn-primary">{back === "settings" ? "Switch to this book" : "Start with this book"}</Submit>
          </form>
        )}
      </div>
    </section>
  );
}

/** Settings: which book the app is built on, and the switch to the other one. Nothing written is lost. */
export function BookSwitch({ edition, saved }: { edition: string; saved?: boolean }) {
  const mine = edition === "RENEWAL" ? "RENEWAL" : "BOTH_HANDS";
  return (
    <div id="book" className="scroll-mt-24">
      <h2 className="h3">My book</h2>
      <p className="mt-1 mb-4 text-[15px] text-ink-soft">The app is built on one of two books. Switching keeps everything you&apos;ve written; only the book&apos;s words and colors change.</p>
      {saved && <p role="status" className="notice mb-4">Switched. The app is now built on {EDITIONS[mine].name}.</p>}
      <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
        <BookCard book={mine} back="settings" current />
        <BookCard book={mine === "RENEWAL" ? "BOTH_HANDS" : "RENEWAL"} back="settings" />
      </div>
    </div>
  );
}
