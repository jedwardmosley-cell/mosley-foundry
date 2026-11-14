import { test } from "node:test";
import assert from "node:assert/strict";
import { parseForgeSource } from "../src/content/forgeParse";

// The author's file format: book sections first, then the app's notes and cards.
const md = `# FORGE source

## Core idea

You only ever rise to the level of who you believe you are. Change the driver
and everything else follows.

## The forge

Metal can't be shaped cold.

## FORGE at a Glance

FORGE is how the driver runs the road ahead.

F, Future Focused. Know your destination.

## Rule 1: Future Focused: Know Your Destination

First paragraph
runs on.

Every leader worth following has this. Back in 1983 Steve Jobs stood up.

Second paragraph.

## Rule 5: Emotionally Anchored: Be Fit to Drive

Five parts of one driver. That's what the forge turns out.

## Selected sources (from the book)

### Mindset

Carol Dweck, Mindset.

# App notes

Status: draft

## Leave out
- Steve Jobs

# Cards

## F

### Rule
Know your destination.

### Why it works
Research line.

### Why it works, more
More research.

### Before you write
Picture it.
- Who is that?
- How do they walk into a place?
`;

test("forge-source.md: the author's sections, the cards, and what is left out", () => {
  const s = parseForgeSource(md);
  assert.equal(s.draft, true);
  assert.equal(s.intro.line, "You only ever rise to the level of who you believe you are.");
  assert.equal(s.intro.core, "Change the driver and everything else follows.");
  assert.equal(s.intro.forge, "Metal can't be shaped cold.");
  assert.equal(s.intro.glance, "FORGE is how the driver runs the road ahead.");
  assert.equal(s.intro.parts, "Five parts of one driver.");
  assert.equal(s.chapter.F?.heading, "Rule 1: Future Focused: Know Your Destination");
  assert.deepEqual(s.chapter.F?.paragraphs, ["First paragraph runs on.", "Second paragraph."], "the Steve Jobs paragraph is left out");
  assert.deepEqual(s.bookSources, [{ group: "Mindset", items: ["Carol Dweck, Mindset."] }]);
  const f = s.cards.F!;
  assert.equal(f.rule, "Know your destination.");
  assert.equal(f.why, "Research line.");
  assert.equal(f.whyMore, "More research.");
  assert.equal(f.beforeIntro, "Picture it.");
  assert.deepEqual(f.before, ["Who is that?", "How do they walk into a place?"]);
  assert.equal(s.cards.O, undefined, "a card that is not written yet stays empty");
});

test("forge-source.md: an approved file is no longer a draft", () => {
  assert.equal(parseForgeSource(md.replace("Status: draft", "Status: approved")).draft, false);
});
