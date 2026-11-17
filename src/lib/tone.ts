/**
 * Set the Tone: the rule-based half of the self-talk coach. No AI, so it works for everyone and can be counted.
 * It finds closed-door phrases ("I can't", "that's just how I am") and notices words that sound like real distress,
 * so the app points to support instead of coaching.
 */

/** Closed-door phrases: language that shuts the door before the world does. Each has a label the client sees. */
/**
 * Each phrase comes with the new way to say it (instead) and why it matters (why): what the words instruct
 * your brain to believe, the proof your mind will go find, and what your body does with it.
 */
export const CLOSED_DOORS: { label: string; re: RegExp; instead: string; why: string }[] = [
  { label: "I can't", re: /\bI\s+(?:can't|cant|cannot|can not)\b/gi, instead: "I haven't done this yet.", why: "This tells your brain to stop looking for a way. It will stop, and your body will act like the door is locked." },
  { label: "I don't know how", re: /\bI\s+(?:don't|dont|do not)\s+know\s+how\b/gi, instead: "I'm still learning how.", why: "This tells your brain the answer isn't there, so it stops searching. Say you're still learning and it keeps working on it." },
  { label: "I don't know", re: /\bI\s+(?:don't|dont|do not)\s+know\b(?!\s+how)/gi, instead: "I don't know yet. I'll find out.", why: "This gives your brain permission to stop thinking. Your mind takes whatever exit you hand it." },
  { label: "that's just how I am", re: /\b(?:that's|thats|that is)\s+(?:just\s+)?(?:how|who|the way)\s+I\s+am\b/gi, instead: "That's how I've handled it so far.", why: "This tells your brain you're finished growing. Your mind will defend the old version of you and call it who you are." },
  { label: "I'm not good at", re: /\bI(?:'m|m| am)\s+(?:just\s+)?not\s+(?:good|great)\s+(?:at|with)\b/gi, instead: "I'm still getting better at this.", why: "This tells your brain to expect failure here. Your mind will count every mistake as proof and skip every win." },
  { label: "I'm not a ... person", re: /\bI(?:'m|m| am)\s+(?:just\s+)?not\s+an?\s+\w+(?:\s+\w+)?\s+person\b/gi, instead: "I haven't made this part of who I am yet.", why: "This writes a rule into your identity. Your mind will keep that rule even when the evidence says otherwise." },
  { label: "I always mess up", re: /\bI\s+always\s+(?:mess|screw|blow|ruin|fail)\w*/gi, instead: "I've missed before. I'm learning what works.", why: "This orders your brain to find every time you messed up. It will find them, and it will miss every time you didn't." },
  { label: "it's impossible", re: /\b(?:it's|its|it is|that's|thats|that is)\s+impossible\b/gi, instead: "I haven't found the way yet.", why: "This tells your brain the search is over before it starts. Your mind won't spend energy on something it's been told can't happen." },
  { label: "there's no way", re: /\bthere(?:'s|s| is)\s+no\s+way\b/gi, instead: "I haven't found the way yet.", why: "This closes every road before you've looked down one. Your mind will stop looking for the way you said doesn't exist." },
  { label: "I have no choice", re: /\bI\s+(?:have|got)\s+no\s+choice\b/gi, instead: "I'm choosing this, and I can choose again.", why: "This hands the wheel to someone else. Your mind will stop seeing the choices you still have." },
  { label: "what's the point", re: /\bwhat(?:'s|s| is)\s+the\s+point\b/gi, instead: "This matters because of who I'm becoming.", why: "This tells your brain the effort is wasted. Your body will pull back its energy to match." },
  { label: "I'm such a ...", re: /\bI(?:'m|m| am)\s+such\s+an?\s+(?:idiot|failure|mess|fraud|imposter|impostor|loser|joke)\b/gi, instead: "I made a mistake. I'm not the mistake.", why: "This is a verdict on who you are. Your mind will go looking for proof that the verdict is right, and it will find some." },
  { label: "why bother", re: /\bwhy\s+bother\b/gi, instead: "This is worth doing because of who I'm becoming.", why: "This tells your body to save its energy. It will, and the work will show it." },
  { label: "I'm struggling", re: /\bI(?:'m|m| am)\s+(?:really\s+|so\s+|just\s+)?struggling\b/gi, instead: "This is hard, and I'm still in it.", why: "This tells your brain the struggle is who you are right now. Name what's hard and that you're still in it, and your mind starts looking for the way through." },
  { label: "I'm not enough", re: /\bI(?:'m|m| am)\s+(?:just\s+)?not\s+(?:good\s+|smart\s+|strong\s+)?enough\b/gi, instead: "I'm enough to take the next step.", why: "This tells your brain you're short before you start. Your mind will find the gap, and your body will play small to match." },
  { label: "this is too much", re: /\b(?:this|it)(?:'s|s| is)\s+(?:just\s+|all\s+)?too\s+much\b/gi, instead: "This is a lot. I'll take the next piece.", why: "This tells your brain you're already beaten. Your body tightens up and your thinking narrows to match." },
  // The imposter often talks in the second person.
  { label: "you can't", re: /\byou\s+(?:can't|cant|cannot|can not)\b/gi, instead: "I haven't done this yet.", why: "This is the imposter giving your brain an order. Your mind will look for proof that it's right unless you answer it." },
  { label: "you're not enough", re: /\byou(?:'re|re| are)\s+(?:just\s+)?not\s+(?:good\s+|smart\s+|strong\s+)?enough\b/gi, instead: "I'm enough to take the next step.", why: "This is the imposter telling your brain you're short before you start. Leave it unanswered and your body plays small to match." },
  { label: "you'll never ...", re: /\byou(?:'ll|ll| will)\s+never\s+(?:be|get|make|figure|finish|change|catch|measure)\b/gi, instead: "I'm not there yet.", why: "This is the imposter deciding the ending for you. Your mind will start acting it out unless you answer it." },
  { label: "you're such a ...", re: /\byou(?:'re|re| are)\s+such\s+an?\s+(?:idiot|failure|mess|fraud|imposter|impostor|loser|joke)\b/gi, instead: "I made a mistake. I'm not the mistake.", why: "This is the imposter handing down a verdict. Your mind will go looking for proof that it's right, and it will find some." },
  { label: "who am I to", re: /\bwho\s+am\s+I\s+to\b/gi, instead: "I'm the one who chose to do this.", why: "This asks your brain for reasons you don't belong. It will find them, and it will skip every reason you do." },
  { label: "I'll never ...", re: /\bI(?:'ll|ll| will)\s+never\s+(?:be|get|make|figure|finish|change|catch|measure)\b/gi, instead: "I'm not there yet.", why: "This tells your brain the outcome is already decided. Your effort will drop to match the story." },
];

export type DoorHit = { label: string; said: string; instead: string; why: string };

/** Every closed-door phrase in the text, in the order they appear, with the words as written. */
export function findClosedDoors(text: string): DoorHit[] {
  const hits: { at: number; hit: DoorHit }[] = [];
  for (const d of CLOSED_DOORS) {
    for (const m of text.matchAll(d.re)) hits.push({ at: m.index ?? 0, hit: { label: d.label, said: m[0], instead: d.instead, why: d.why } });
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
