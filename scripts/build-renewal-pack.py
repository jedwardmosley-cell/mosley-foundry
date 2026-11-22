#!/usr/bin/env python3
"""Build The Road to Renewal content pack from the author's Word file.

Usage:
  python3 -I scripts/build-renewal-pack.py <RoadToRenewal.docx> <base pack.json> <output pack-renewal.json>

The Renewal edition is the same app as Both Hands on the Wheel, built on a different book. So the output starts
from the Both Hands pack (the five rules, the assessment, the 30 days) and replaces what comes from the book:
the ten chapters (lessons, Refuel, Reflect, Road Test), the source, and the FORGE Process questions asked
"before God".

The output is proprietary content and is gitignored (src/content/licensed/). This script contains parsing logic only.
Typography follows the Both Hands build: em dashes become commas.
"""
import json
import re
import sys
import zipfile


def clean(s):
    s = re.sub(r"(\d)\s*–\s*(\d)", r"\1 to \2", s)
    s = re.sub(r"\s+—\s+", ", ", s)
    s = s.replace("—", ", ").replace("–", "-").replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace(" , ", ", ").replace(",,", ",")
    return re.sub(r"\s+", " ", s).strip()


def paragraphs(docx):
    """(style, text) for every paragraph in the document body, in order."""
    xml = zipfile.ZipFile(docx).read("word/document.xml").decode("utf-8")
    out = []
    for p in re.findall(r"<w:p[ >].*?</w:p>", xml, re.S):
        st = re.search(r'w:pStyle w:val="([^"]+)"', p)
        text = "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p))
        text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'")
        if text.strip():
            out.append((st.group(1) if st else "", clean(text)))
    return out


def title_case(s):
    small = {"of", "the", "to", "and", "a", "in", "on", "by"}
    words = s.lower().split()
    return " ".join(w if (i and w in small) else w[:1].upper() + w[1:] for i, w in enumerate(words)).replace("'S", "'s")


SECTION = {"Refuel": "refuel", "Reflect": "reflect", "Road Test": "roadTest"}


def parse(paras):
    chapters, forge, checkins = [], {}, []
    cur, mode, in_forge, letter, ask = None, None, False, None, False
    for style, t in paras:
        heading = style.lower().startswith("heading1") or style.lower() == "heading1"
        m = re.match(r"^CHAPTER (\d+): (.+)$", t)
        if m:
            cur = {"number": int(m.group(1)), "title": title_case(m.group(2)), "subtitle": "", "lessons": [], "refuel": [], "reflect": [], "roadTest": []}
            check = {"verse": "", "reference": "", "prayer": []}
            checkins.append(check)
            chapters.append(cur)
            mode, in_forge = None, False
            continue
        if heading and t.upper() == "THE FORGE PROCESS":
            cur, in_forge = None, True
            continue
        if heading:  # INTRODUCTION, A FINAL WORD...
            cur, in_forge, mode = None, False, None
            continue
        if in_forge:
            lm = re.match(r"^([FORGE]): (.+)$", t)
            if lm:
                letter, ask = lm.group(1), False
                forge[letter] = {"name": lm.group(2), "text": [], "questions": []}
                continue
            if letter and t.lower().startswith("ask yourself before god"):
                ask = True
                continue
            if letter and ask:
                # The questions end at the first line that isn't one; whatever follows closes the section.
                if t.endswith("?") or (forge[letter]["questions"] and not forge[letter]["questions"][-1].endswith("?")):
                    forge[letter]["questions"].append(t)
                else:
                    letter, ask = None, False
                continue
            if letter:
                forge[letter]["text"].append(t)
            continue
        if not cur:
            continue
        if not cur["subtitle"] and not re.match(r"^Lesson \d", t):
            cur["subtitle"] = t
            continue
        if re.match(r"^Lesson \d+: ", t):
            cur["lessons"].append(t)
            mode = None
            continue
        # Chapter 9 in Renewal: the Ten Pathways of Promise, each with its Detour of Destruction.
        pm = re.match(r"^Pathway (\d+): (.+)$", t)
        if pm:
            cur.setdefault("pathways", []).append({"number": int(pm.group(1)), "name": pm.group(2), "detour": ""})
            cur["lessons"].append(t)
            mode = None
            continue
        dm = re.match(r"^Detour of Destruction: (.+)$", t)
        if dm and cur.get("pathways"):
            cur["pathways"][-1]["detour"] = dm.group(1)
            continue
        if t in SECTION:
            mode = SECTION[t]
            continue
        # The Faith Check-In closes each chapter: a verse, its reference, then a prayer from "Lord," to "Amen."
        if t.lower().startswith("faith check-in"):
            mode = "faith"
            continue
        if mode == "faith":
            if not check["verse"]:
                check["verse"] = t.strip('"')
            elif not check["reference"] and re.match(r"^[-,]?\s*\d?\s*[A-Z][a-z]+", t) and len(t) < 40:
                check["reference"] = re.sub(r"^[-,]\s*", "", t)
            else:
                check["prayer"].append(t)
            continue
        if mode:
            cur[mode].append(t)
    for c, k in zip(chapters, checkins):
        if k["verse"]:
            c["faithCheckIn"] = k
    return chapters, forge


def main():
    docx, base, out = sys.argv[1], sys.argv[2], sys.argv[3]
    pack = json.load(open(base, encoding="utf-8"))
    chapters, forge = parse(paragraphs(docx))
    if len(chapters) < 8:
        sys.exit(f"Found only {len(chapters)} chapters. Is this The Road to Renewal Word file?")
    pack["chapters"] = chapters
    pack["sources"] = [{"id": "renewal", "title": "The Road to Renewal: Faith, Discipline, and the Journey to Lasting Change", "author": "Jason Mosley"}]
    pack["edition"] = "RENEWAL"
    pack["faith"] = {"forge": forge}
    json.dump(pack, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(chapters)} chapters; FORGE letters: {''.join(forge)}; written to {out}")
    for c in chapters:
        k = c.get("faithCheckIn")
        print(f"  {c['number']:>2}. {c['title']}: {len(c['lessons'])} lessons, refuel {len(c['refuel'])}, reflect {len(c['reflect'])}, road test {len(c['roadTest'])}, faith check-in {k['reference'] + ', prayer ' + str(len(k['prayer'])) + ' lines' if k else 'none'}")


if __name__ == "__main__":
    main()
