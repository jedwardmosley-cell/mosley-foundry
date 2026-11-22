import { bookFor, BOOK_NUDGES } from "@/content/book";
import { getCurrentUser } from "@/lib/auth";

/** A one-line, low-key nudge to read the book. Links out when the purchase link is set. */
export async function ReadTheBook({ kind = "general", className = "" }: { kind?: keyof typeof BOOK_NUDGES; className?: string }) {
  const BOOK = bookFor((await getCurrentUser())?.edition);
  const title = <span className="font-serif italic">{BOOK.title}</span>;
  return (
    <p className={`text-sm text-ink-soft ${className}`}>
      {BOOK_NUDGES[kind]}{" "}
      {BOOK.url ? <a href={BOOK.url} target="_blank" rel="noopener noreferrer" className="btn-link">{title}</a> : title}.
    </p>
  );
}
