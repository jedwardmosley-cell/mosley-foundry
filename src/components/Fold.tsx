"use client";
import { useState } from "react";

/** Long text folded to its first part: More opens the rest, Less at the end folds it back. Works as a plain toggle. */
export function Fold({ lead, rest }: { lead: string; rest: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="block">
      {lead}{" "}
      {!open && <button type="button" onClick={() => setOpen(true)} aria-expanded={false} className="text-link">More</button>}
      {open && (
        <>
          <span className="mt-2 block">{rest}</span>
          <button type="button" onClick={() => setOpen(false)} aria-expanded={true} className="mt-2 text-link">Less</button>
        </>
      )}
    </span>
  );
}
