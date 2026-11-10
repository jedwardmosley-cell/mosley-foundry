#!/usr/bin/env python3
"""Build the licensed content pack from the author's source documents.

Usage:
  python3 -I scripts/build-content-pack.py <source-dir> <output.json>

<source-dir> must contain plain-text exports of:
  manuscript.txt  Both Hands on the Wheel manuscript
  workbook.txt    Both Hands on the Wheel Personal Application Workbook (v3)

The output file is proprietary content and is gitignored
(src/content/licensed/pack.json). This script contains parsing logic only.

Typography: the author's own edit notes ask for em dashes to be removed from
participant-facing material, so this script converts them.
"""
import json
import re
import sys


def clean(s: str) -> str:
    s = s.replace("\\*", "*").replace("\\_", "_").replace("\\=", "=")
    s = re.sub(r"(\d)\s*–\s*(\d)", r"\1 to \2", s)  # numeric ranges
    s = re.sub(r"\s+—\s+", ", ", s)
    s = s.replace("—", ", ").replace("–", "-")
    s = s.replace(" , ", ", ").replace(",,", ",")
    return re.sub(r"\s+", " ", s).strip()


def lines_of(text):
    return [l.rstrip() for l in text.splitlines()]


PILLARS = [
    ("F", "Future Focused", "Know your destination."),
    ("O", "Outcome Aware", "Watch the signs."),
    ("R", "Reason Rooted", "Know why the trip matters."),
    ("G", "Growth Oriented", "Recalculate without ego."),
    ("E", "Emotionally Anchored", "Be fit to drive."),
]


def parse_workbook(text):
    L = lines_of(text)
    out = {"pillars": {}, "totalBands": [], "profiles": [], "edsLessons": [], "jaysJourney": []}

    # Abbreviated anchors + reflection prompts (Section One)
    for l in L:
        m = re.match(r"^\| ([FOREG]) ([A-Za-z-]+-[A-Za-z]+)(.*?)RATE YOURSELF.*?Reflection [—-] (.*?)\\?_", l)
        if m:
            key = m.group(1)
            out["pillars"].setdefault(key, {})["reflection"] = clean(m.group(4))
            continue
        m = re.match(r"^\| ([FOREG]) ([A-Za-z]+-[A-Za-z]+)(.*?)1 (.*?) 3 (.*?) 5 (.*?) \|$", l)
        if m:
            key = m.group(1)
            d = out["pillars"].setdefault(key, {})
            d["brief"] = {"1": clean(m.group(4)), "3": clean(m.group(5)), "5": clean(m.group(6))}

    # Full anchor tables
    cur = None
    for l in L:
        m = re.match(r"^([FOREG]) — ", l)
        if m:
            cur = m.group(1)
            nxt = L[L.index(l) + 2]
            out["pillars"][cur]["definition"] = clean(nxt)
        m = re.match(r"^\| ([1-5]) \| (Not Yet|Developing|Operating|Integrated|Leading) \| (.*) \|$", l)
        if m and cur:
            out["pillars"][cur].setdefault("anchors", []).append(
                {"score": int(m.group(1)), "level": m.group(2), "text": clean(m.group(3))}
            )

    # Lowest-pillar guidance
    cur = None
    for l in L:
        m = re.match(r"^([FOREG]) (Future|Outcome|Reason|Growth|Emotionally)[- ]", l)
        if m and "|" not in l:
            cur = m.group(1)
        m = re.match(r"^\| (\d) – (\d) \| (.*) \|$", l)
        if m and cur:
            out["pillars"][cur].setdefault("lowest", []).append(
                {"min": int(m.group(1)), "max": int(m.group(2)), "text": clean(m.group(3))}
            )

    # Total bands
    for l in L:
        m = re.match(r"^(20 – 25|14 – 19|Below 14) (.*)$", l)
        if m:
            label = clean(m.group(1))
            lo, hi = {"20 to 25": (20, 25), "14 to 19": (14, 19), "Below 14": (5, 13)}[label]
            out["totalBands"].append({"label": label, "min": lo, "max": hi, "text": clean(m.group(2))})
    for l in L:
        if l.startswith("| The pattern matters more than the total:"):
            out["patternNote"] = clean(l.strip("| ").replace("The pattern matters more than the total:", ""))
        if l.startswith("| A score of 3 is not failure."):
            out["threeNote"] = clean(l.strip("| "))

    # Profiles (Section Three)
    i = 0
    while i < len(L):
        m = re.match(r"^\| (The Founder|The Coach|The Mentor|Ed at the Insurance Company)Composite [—-] (.*) \|$", L[i])
        if m:
            prof = {"name": m.group(1), "subtitle": clean(m.group(2)), "scores": {}}
            j = i + 1
            while j < len(L) and not L[j].startswith("| DESIGNED DISCIPLINE"):
                sm = re.match(r"^\| ([FOREG]) — .*? \| (\d) / 5 \|$", L[j])
                if sm:
                    prof["scores"][sm.group(1)] = int(sm.group(2))
                if L[j].startswith("The Story Behind") and j + 2 < len(L):
                    prof["story"] = clean(L[j + 2])
                j += 1
            if j < len(L):
                prof["designedDiscipline"] = clean(L[j].strip("| ").replace("DESIGNED DISCIPLINE FACTOR", ""))
            k = j + 1
            while k < len(L) and not L[k].startswith("| THE LESSON"):
                k += 1
            if k < len(L):
                prof["lesson"] = clean(L[k].strip("| ").replace("THE LESSON", ""))
            out["profiles"].append(prof)
            i = k
        i += 1

    # Ed's Lessons (Section Four)
    sec4 = L.index("Section Four")
    sec5 = L.index("Section Five")
    block = [l for l in L[sec4:sec5] if l.strip() and not l.startswith("\\_") and l.strip() != "| :-: |" and l.strip() != "|  |"]
    cur = None
    for l in block:
        m = re.match(r"^From (The [^—]+|Wheel Alignment) — (.*)$", l)
        if m:
            cur = {"chapter": clean(m.group(1)), "title": clean(m.group(2)), "prompts": []}
            out["edsLessons"].append(cur)
            continue
        if not cur:
            continue
        if l.startswith("| "):
            cur["quote"] = clean(l.strip("| "))
        elif l.startswith("First layer:") or l.startswith("Second layer:"):
            cur["prompts"].append(clean(l))
        elif "setup" not in cur:
            cur["setup"] = clean(l)

    # Jay's Journey (Section Five)
    sec6 = L.index("Section Six")
    block = [l for l in L[sec5:sec6] if l.strip() and not l.startswith("\\_") and not l.startswith("|")]
    titles = ["The Flight You Keep Missing", "The Expert Who Keeps Talking", "The Wrong Terrain",
              "The Achievement That Has Not Landed", "What You Are Avoiding"]
    cur = None
    for l in block:
        if l in titles:
            cur = {"title": l, "prompts": []}
            out["jaysJourney"].append(cur)
        elif cur:
            if "setup" not in cur:
                cur["setup"] = clean(l)
            else:
                cur["prompts"].append(clean(l))

    # 30-day plan (Section Seven)
    plan = []
    for l in L:
        m = re.match(r"^\| (Week \d|Day 30) \| (\w+) \| (.*?) \| (.*?) \|$", l)
        if m:
            plan.append({"label": m.group(1), "focus": m.group(2), "work": clean(m.group(3))})
    out["thirtyDayPlan"] = plan

    # Name your people (Section Eight)
    people = []
    for l in L:
        m = re.match(r"^My (mentor|accountability partner|mentee) — (.*):$", l)
        if m:
            people.append({"role": m.group(1), "prompt": clean(m.group(2))})
    out["namePeople"] = people
    for l in L:
        if l.startswith("| If the answer to any of these is nobody:"):
            out["nobodyNote"] = clean(l.strip("| ").replace("If the answer to any of these is nobody:", ""))
        if l.startswith("| Hold yourself to this:"):
            out["holdYourself"] = clean(l.strip("| ").replace("Hold yourself to this:", ""))
    i = L.index("Your FORGE Statement")
    out["forgeStatementPrompt"] = clean(L[i + 2])
    i = L.index("Section Six")
    out["actionPlanIntro"] = clean(L[i + 6])
    return out


CHAPTERS = [
    "THE DRIVER'S SEAT", "THE VEHICLE CONTROLS", "THE DASHBOARD", "THE CENTER CONSOLE",
    "WHEEL ALIGNMENT", "VEHICLE TYPE", "THE WINDSHIELD", "THE MIRRORS",
    "THE RULES OF THE ROAD", "DISCIPLINE BY DESIGN",
]


def parse_manuscript(text):
    L = [l for l in lines_of(text)]
    idx = {}
    for n, title in enumerate(CHAPTERS):
        idx[title] = L.index(title)
    chapters = []
    for n, title in enumerate(CHAPTERS):
        start = idx[title]
        end = idx[CHAPTERS[n + 1]] if n + 1 < len(CHAPTERS) else L.index("SELECTED SOURCES AND INFLUENCES")
        body = [l for l in L[start:end] if l.strip()]
        ch = {"number": n + 1, "title": title.title().replace("'S", "'s"), "subtitle": clean(body[1]),
              "lessons": [], "refuel": [], "reflect": [], "roadTest": []}
        mode = None
        for l in body:
            if re.match(r"^(Lesson \d|Rule \d): ", l):
                ch["lessons"].append(clean(l))
                mode = None
                continue
            if l in ("Refuel", "Reflect", "Road Test", "Mile Markers"):
                mode = {"Refuel": "refuel", "Reflect": "reflect", "Road Test": "roadTest", "Mile Markers": None}[l]
                continue
            if mode:
                ch[mode].append(clean(l))
        chapters.append(ch)

    # Chapter 9 rule passages
    rules = {}
    s = idx["THE RULES OF THE ROAD"]
    e = idx["DISCIPLINE BY DESIGN"]
    cur = None
    for l in L[s:e]:
        m = re.match(r"^Rule (\d): ([A-Za-z ]+): (.*)$", l)
        if m:
            cur = "FORGE"[int(m.group(1)) - 1]
            rules[cur] = {"heading": clean(l), "paragraphs": []}
            continue
        if l == "Mile Markers":
            cur = None
        if cur and l.strip():
            rules[cur]["paragraphs"].append(clean(l))

    # Chapter 10: discipline passages and the Design Inventory
    s = idx["DISCIPLINE BY DESIGN"]
    e = L.index("SELECTED SOURCES AND INFLUENCES")
    d = [l for l in L[s:e] if l.strip()]
    intro = []
    for l in d[2:]:
        if l == "\\*\\*\\*":
            break
        intro.append(clean(l))
    inventory = []
    i = d.index("Your Design Inventory")
    for l in d[i + 1:]:
        m = re.match(r"^(Daily|Weekly|Your [a-z]+)\. (.*)$", l)
        if not m:
            break
        inventory.append({"label": m.group(1), "text": clean(m.group(2))})

    def section(head, stop):
        a = d.index(head)
        b = d.index(stop)
        return [clean(x) for x in d[a + 1:b]]

    discipline = {
        "intro": intro,
        "whatDisciplineIs": section("What Discipline Is", "Go through this inventory and see what you've actually built."),
        "inventory": inventory,
        "whosChecking": section("So Who's Checking?", "Now the Part That Isn't About You"),
        "leadingOthers": section("Now the Part That Isn't About You", "A Note to the Reader"),
    }
    return chapters, rules, discipline


def main():
    src, out_path = sys.argv[1], sys.argv[2]
    wb = parse_workbook(open(f"{src}/workbook.txt", encoding="utf-8").read())
    chapters, rules, discipline = parse_manuscript(open(f"{src}/manuscript.txt", encoding="utf-8").read())
    pillars = []
    for key, name, short in PILLARS:
        p = wb["pillars"][key]
        assert len(p.get("anchors", [])) == 5, (key, p.keys())
        assert len(p.get("lowest", [])) == 4, key
        pillars.append({"key": key, "name": name, "short": short, **p, "rule": rules.get(key)})
    pack = {
        "kind": "licensed",
        "version": 1,
        "assessmentStatus": "source",
        "sources": [
            {"id": "book", "title": "Both Hands on the Wheel: Five Rules for the Road Ahead", "author": "Jason E. Mosley"},
            {"id": "workbook", "title": "Both Hands on the Wheel Personal Application Workbook (v3)", "author": "Jason Mosley"},
        ],
        "pillars": pillars,
        "totalBands": wb["totalBands"],
        "patternNote": wb.get("patternNote"),
        "threeNote": wb.get("threeNote"),
        "profiles": wb["profiles"],
        "edsLessons": wb["edsLessons"],
        "jaysJourney": wb["jaysJourney"],
        "thirtyDayPlan": wb["thirtyDayPlan"],
        "namePeople": wb["namePeople"],
        "nobodyNote": wb.get("nobodyNote"),
        "holdYourself": wb.get("holdYourself"),
        "forgeStatementPrompt": wb["forgeStatementPrompt"],
        "actionPlanIntro": wb["actionPlanIntro"],
        "chapters": chapters,
        "discipline": discipline,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(pack, f, indent=2, ensure_ascii=False)
    print(f"wrote {out_path}: {len(pillars)} pillars, {len(chapters)} chapters, "
          f"{len(wb['profiles'])} profiles, {len(wb['edsLessons'])} Ed lessons, {len(wb['jaysJourney'])} Jay exercises")


if __name__ == "__main__":
    main()
