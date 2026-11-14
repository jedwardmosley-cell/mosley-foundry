/** The mark: a wheel, with two hands at ten and two. Uses the theme colors, so it works in light and dark. */
export function BrandMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden>
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="2.4" fill="currentColor" />
      <path d="M16 18.4 V28 M13.9 15 L5.3 12.4 M18.1 15 L26.7 12.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="7.6" cy="9.1" r="3" fill="rgb(var(--gold-hi))" />
      <circle cx="24.4" cy="9.1" r="3" fill="rgb(var(--gold-hi))" />
    </svg>
  );
}
