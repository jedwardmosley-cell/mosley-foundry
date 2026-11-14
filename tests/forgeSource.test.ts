import { test } from "node:test";
import assert from "node:assert/strict";
import { parseForgeSource } from "../src/content/forgeParse";

const md = `# FORGE source
Status: draft

# Intro

## Line
You only ever rise to the level of who you believe you are.

# Chapter 9: The Rules of the Road

Edited note.

## F
### Rule 1: Future Focused: Know Your Destination
First paragraph
runs on.

Second paragraph.

# Cards

## F

### Rule
Know your destination.

### What it means
Teaching.

### Why it works
Research line.

### Why it works, more
More research.

### Before you write
Picture it.
- Who is that?
- How do they walk into a place?
`;

test("forge-source.md: intro, chapter and cards are read in the author's words", () => {
  const s = parseForgeSource(md);
  assert.equal(s.draft, true);
  assert.equal(s.intro.line, "You only ever rise to the level of who you believe you are.");
  assert.equal(s.chapter.F?.heading, "Rule 1: Future Focused: Know Your Destination");
  assert.deepEqual(s.chapter.F?.paragraphs, ["First paragraph runs on.", "Second paragraph."]);
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
