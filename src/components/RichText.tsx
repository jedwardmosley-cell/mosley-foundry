import type { ReactNode } from "react";

/**
 * Renders the small subset of Markdown the AI Companion uses: paragraphs, **bold**,
 * and "-" or "1." lists. Builds React elements only (no HTML injection).
 */
function inline(text: string, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4
      ? <strong key={`${key}-${i}`} className="font-semibold">{part.slice(2, -2)}</strong>
      : <span key={`${key}-${i}`}>{part.replace(/\*\*/g, "")}</span>
  );
}

type Group = { kind: "p" | "ul" | "ol"; lines: string[] };

/** Splits a block into runs of plain lines, dash-list lines and numbered-list lines. */
function group(lines: string[]): Group[] {
  const out: Group[] = [];
  for (const l of lines) {
    const kind: Group["kind"] = /^\s*[-*]\s+/.test(l) ? "ul" : /^\s*\d+[.)]\s+/.test(l) ? "ol" : "p";
    const text = kind === "p" ? l : l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "");
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.lines.push(text);
    else out.push({ kind, lines: [text] });
  }
  return out;
}

export function RichText({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {blocks.flatMap((block, bi) =>
        group(block.split("\n")).map((g, gi) => {
          const key = `${bi}-${gi}`;
          if (g.kind === "p") {
            return <p key={key}>{g.lines.map((l, li) => <span key={li}>{li > 0 && <br />}{inline(l, `${key}-${li}`)}</span>)}</p>;
          }
          const Tag = g.kind;
          return (
            <Tag key={key} className={`${g.kind === "ol" ? "list-decimal" : "list-disc"} pl-5 space-y-1.5`}>
              {g.lines.map((it, ii) => <li key={ii}>{inline(it, `${key}-${ii}`)}</li>)}
            </Tag>
          );
        })
      )}
    </div>
  );
}
