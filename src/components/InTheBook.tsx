/** The book's own words for an exercise, folded under a tap. Read from the licensed content at runtime. */
export function InTheBook({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm text-link">In the book</summary>
      <div className="mt-2 border-l-4 border-lane pl-4 space-y-1.5 text-[15px] text-ink">{lines.map((t) => <p key={t}>{t}</p>)}</div>
    </details>
  );
}
