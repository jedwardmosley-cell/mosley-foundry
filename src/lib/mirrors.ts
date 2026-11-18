/**
 * The Mirrors chapter (Reflection and Learning) in the licensed content, for the weekly look back.
 * Read at runtime, never written into the code. Everything is empty when the licensed pack isn't installed,
 * and the page falls back to its own plain wording.
 */
type Ch = { title: string; lessons: string[]; refuel: string[]; reflect: string[]; roadTest: string[] };

/** "Lesson 1: Some Title Here" becomes "Some title here". */
const lessonName = (s: string) => {
  const t = s.replace(/^lesson\s*\d+\s*:\s*/i, "").trim();
  return t ? t.charAt(0) + t.slice(1).toLowerCase() : "";
};

export function mirrorsFromBook(chapters: Ch[], weekOf: string) {
  const c = chapters.find((x) => /mirrors/i.test(x.title));
  if (!c) return null;
  const lessons = c.lessons.map(lessonName).filter(Boolean);
  // "Look back to ..." lessons, then the one about how long to look.
  const lookBack = lessons.filter((l) => /^look back/i.test(l));
  const glance = lessons.find((l) => !/^look back/i.test(l));
  // A line that ends the chapter's short practice, and its closing line, when they are statements.
  const clearView = [...c.refuel].reverse().find((t) => !t.trim().endsWith("?") && !/:\s*$/.test(t));
  const close = [...c.roadTest].reverse().find((t) => !t.trim().endsWith("?") && !/:\s*$/.test(t));
  // One of the chapter's questions, a different one each week.
  const questions = [...c.refuel, ...c.reflect].filter((t) => t.trim().endsWith("?"));
  const n = Math.floor(new Date(`${weekOf}T00:00:00`).getTime() / (7 * 864e5));
  const question = questions.length ? questions[((n % questions.length) + questions.length) % questions.length] : undefined;
  return { lookBack, glance, clearView, close, question };
}
