import type { ReactNode } from "react";

/**
 * Renders the author's teaching guide: paragraphs with **bold** lead-ins and *italic* titles,
 * and simple pipe tables. Builds React elements only (no HTML injection).
 */
function inline(text: string, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={`${key}-${i}`} className="font-semibold text-heading">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={`${key}-${i}`}>{part.slice(1, -1)}</em>;
    return <span key={`${key}-${i}`}>{part}</span>;
  });
}

function table(block: string, key: string) {
  const rows = block.split("\n").filter((l) => l.trim().startsWith("|") && !/^\|\s*-/.test(l.trim()))
    .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  const [head, ...body] = rows;
  return (
    <div key={key} className="overflow-x-auto">
      <table className="w-full text-left text-[15px]">
        <thead><tr>{head.map((h, i) => <th key={i} className="pb-2 pr-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">{h}</th>)}</tr></thead>
        <tbody>{body.map((r, ri) => <tr key={ri} className="border-t border-line/70">{r.map((c, ci) => <td key={ci} className={`py-2.5 pr-4 align-top ${ci === 0 ? "font-medium text-heading" : ""}`}>{inline(c, `${key}-${ri}-${ci}`)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function GuideText({ md, className = "" }: { md: string; className?: string }) {
  const blocks = md.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={`space-y-4 text-[16px] leading-relaxed ${className}`}>
      {blocks.map((b, i) => (b.startsWith("|") ? table(b, `t${i}`) : <p key={i}>{inline(b.replace(/\n/g, " "), `p${i}`)}</p>))}
    </div>
  );
}
