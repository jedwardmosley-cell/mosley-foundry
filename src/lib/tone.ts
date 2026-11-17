/**
 * Set the Tone: the rule-based half of the self-talk coach. No AI, so it works for everyone and can be counted.
 * It finds closed-door phrases ("I can't", "that's just how I am") and notices words that sound like real distress,
 * so the app points to support instead of coaching.
 */

/** Closed-door phrases: language that shuts the door before the world does. Each has a label the client sees. */
export const CLOSED_DOORS: { label: string; re: RegExp }[] = [
  { label: "I can't", re: /\bI\s+(?:can't|cant|cannot|can not)\b/gi },
  { label: "I don't know how", re: /\bI\s+(?:don't|dont|do not)\s+know\s+how\b/gi },
  { label: "I don't know", re: /\bI\s+(?:don't|dont|do not)\s+know\b(?!\s+how)/gi },
  { label: "that's just how I am", re: /\b(?:that's|thats|that is)\s+(?:just\s+)?(?:how|who|the way)\s+I\s+am\b/gi },
  { label: "I'm not good at", re: /\bI(?:'m|m| am)\s+(?:just\s+)?not\s+(?:good|great)\s+(?:at|with)\b/gi },
  { label: "I'm not a ... person", re: /\bI(?:'m|m| am)\s+(?:just\s+)?not\s+an?\s+\w+(?:\s+\w+)?\s+person\b/gi },
  { label: "I always mess up", re: /\bI\s+always\s+(?:mess|screw|blow|ruin|fail)\w*/gi },
  { label: "it's impossible", re: /\b(?:it's|its|it is|that's|thats|that is)\s+impossible\b/gi },
  { label: "there's no way", re: /\bthere(?:'s|s| is)\s+no\s+way\b/gi },
  { label: "I have no choice", re: /\bI\s+(?:have|got)\s+no\s+choice\b/gi },
  { label: "what's the point", re: /\bwhat(?:'s|s| is)\s+the\s+point\b/gi },
  { label: "I'm such a ...", re: /\bI(?:'m|m| am)\s+such\s+an?\s+(?:idiot|failure|mess|fraud|imposter|impostor|loser|joke)\b/gi },
  { label: "why bother", re: /\bwhy\s+bother\b/gi },
  { label: "I'm struggling", re: /\bI(?:'m|m| am)\s+(?:really\s+|so\s+|just\s+)?struggling\b/gi },
  { label: "I'm not enough", re: /\bI(?:'m|m| am)\s+(?:just\s+)?not\s+(?:good\s+|smart\s+|strong\s+)?enough\b/gi },
  { label: "this is too much", re: /\b(?:this|it)(?:'s|s| is)\s+(?:just\s+|all\s+)?too\s+much\b/gi },
  // The imposter often talks in the second person.
  { label: "you can't", re: /\byou\s+(?:can't|cant|cannot|can not)\b/gi },
  { label: "you're not enough", re: /\byou(?:'re|re| are)\s+(?:just\s+)?not\s+(?:good\s+|smart\s+|strong\s+)?enough\b/gi },
  { label: "you'll never ...", re: /\byou(?:'ll|ll| will)\s+never\s+(?:be|get|make|figure|finish|change|catch|measure)\b/gi },
  { label: "you're such a ...", re: /\byou(?:'re|re| are)\s+such\s+an?\s+(?:idiot|failure|mess|fraud|imposter|impostor|loser|joke)\b/gi },
  { label: "who am I to", re: /\bwho\s+am\s+I\s+to\b/gi },
  { label: "I'll never ...", re: /\bI(?:'ll|ll| will)\s+never\s+(?:be|get|make|figure|finish|change|catch|measure)\b/gi },
];

export type DoorHit = { label: string; said: string };

/** Every closed-door phrase in the text, in the order they appear, with the words as written. */
export function findClosedDoors(text: string): DoorHit[] {
  const hits: { at: number; hit: DoorHit }[] = [];
  for (const d of CLOSED_DOORS) {
    for (const m of text.matchAll(d.re)) hits.push({ at: m.index ?? 0, hit: { label: d.label, said: m[0] } });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.hit);
}

/** How often each closed-door phrase came up, most often first. For the three-day audit and the weekly look back. */
export function tally(hits: DoorHit[]): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const h of hits) m.set(h.label, (m.get(h.label) ?? 0) + 1);
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Words that may mean someone is in real distress. The app stops coaching and points to support. */
const DISTRESS = [
  /\b(?:kill|hurt|harm|cut)\s+myself\b/i,
  /\bsuicid/i,
  /\bself[-\s]?harm/i,
  /\b(?:want|wanna|going)\s+to\s+die\b/i,
  /\bend\s+(?:it\s+all|my\s+life)\b/i,
  /\bbetter\s+off\s+(?:dead|without\s+me)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bdon'?t\s+want\s+to\s+(?:be\s+here|live|wake\s+up)\b/i,
];

export function soundsLikeDistress(text: string): boolean {
  return DISTRESS.some((re) => re.test(text));
}

/**
 * The book's own self-talk questions, from the Center Console chapter (Mindset and Tone Setting) in the
 * licensed content. Read at runtime, never written into the code. Empty when the licensed pack isn't installed.
 */
export function bookQuestions(chapters: { title: string; refuel: string[]; reflect: string[] }[]): string[] {
  const c = chapters.find((x) => /center console/i.test(x.title));
  if (!c) return [];
  return [...c.reflect, ...c.refuel].filter((t) => t.trim().endsWith("?") && /self-talk|tone|language|temperature|believe|voice/i.test(t));
}
