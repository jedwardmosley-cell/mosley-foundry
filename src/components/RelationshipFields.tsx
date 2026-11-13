"use client";
import { useState } from "react";
import { RELATIONSHIP_ROLES } from "@/content/program";
import { RELATIONSHIP_PURPOSE, CADENCES } from "@/content/options";
import { Picks } from "./Picks";

/** Role, purpose and cadence for a new relationship, with role-aware purpose suggestions. */
export function RelationshipFields({ initialRole, purposeFolded = false }: { initialRole?: string; purposeFolded?: boolean }) {
  const [role, setRole] = useState(initialRole ?? "ACCOUNTABILITY_PARTNER");
  return (
    <>
      <label className="block">
        <span className="label">Role</span>
        <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          {Object.entries(RELATIONSHIP_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Check in</span>
        <select name="cadenceDays" className="input" defaultValue="14">
          {CADENCES.map((c) => <option key={c.days} value={c.days}>{c.label}</option>)}
        </select>
      </label>
      <details className="sm:col-span-2" open={!purposeFolded}>
        <summary className={purposeFolded ? "cursor-pointer text-sm text-link" : "hidden"}>Purpose (optional)</summary>
        <label className="block">
          <span className="label">Purpose <span className="text-ink-mute font-normal">(what is this relationship for?)</span></span>
          <input name="purpose" maxLength={1000} className="input" />
        </label>
        {RELATIONSHIP_PURPOSE[role] && <Picks key={role} list={RELATIONSHIP_PURPOSE[role]} target="purpose" />}
      </details>
    </>
  );
}
