/** Turns what was typed after the fixed "I am" into a full present-tense claim. */
export function toClaim(raw: string) {
  let t = raw.trim().replace(/^(i am|i'm)\s+/i, "").trim();
  if (/^(a|an|the|someone|somebody)\b/i.test(t) && /^[A-Z]/.test(t)) t = t[0].toLowerCase() + t.slice(1);
  return `I am ${t}`;
}
