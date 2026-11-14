"use client";
import { useMemo, useState } from "react";
import { shareMessage, menteeMessage } from "@/content/weekOne";
import { RELATIONSHIP_ROLES } from "@/content/program";
import { ShareSend } from "./ShareSend";

type Person = { id: string; name: string; role: string; email: string | null };
type Answers = { situation: string; feeling: string; oldResponse: string; newResponse: string; gap: string };

/** "Who finds out?": pick one person, read the message, choose what else to share, then send. */
export function SetupShare({ people, mentees, answers, plan, initial }: {
  people: Person[]; mentees: Person[]; answers: Answers; plan: string;
  initial: { to: string | null; feeling: boolean; old: boolean; gap: boolean };
}) {
  const [to, setTo] = useState(initial.to ?? people[0]?.id ?? "");
  const [t, setT] = useState({ feeling: initial.feeling, old: initial.old, gap: initial.gap });
  const built = useMemo(() => shareMessage(answers, t), [answers, t]);
  const [edited, setEdited] = useState<string | null>(null);
  const message = edited ?? built;
  const person = people.find((p) => p.id === to);
  const first = person?.name.split(" ")[0] ?? "them";
  const toggle = (k: keyof typeof t, label: string) => (
    <label className="flex items-center justify-between gap-4 border-t border-line/70 py-3 text-[15px]">
      <span>{label}</span>
      <input type="checkbox" checked={t[k]} onChange={(e) => { setT({ ...t, [k]: e.target.checked }); setEdited(null); }} className="h-5 w-5 accent-navy" />
    </label>
  );
  return (
    <div>
      <fieldset>
        <legend className="sr-only">Who finds out</legend>
        <div className="space-y-2">
          {people.map((p) => (
            <label key={p.id} className="cursor-pointer block">
              <input type="radio" name="to" value={p.id} checked={to === p.id} onChange={() => setTo(p.id)} className="peer sr-only" />
              <span className="option !flex items-center gap-3 !py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy/10 text-xs font-semibold text-heading">{p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                <span><span className="block text-[15px] font-medium">{p.name}</span><span className="block text-xs text-ink-mute">{RELATIONSHIP_ROLES[p.role as keyof typeof RELATIONSHIP_ROLES] ?? p.role}</span></span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="section-label mt-6">What {first} gets</p>
      <textarea aria-label={`Message to ${first}`} value={message} onChange={(e) => setEdited(e.target.value)} className="textarea mt-2 !min-h-[96px]" maxLength={1500} />
      <div className="mt-2">
        {toggle("feeling", "Also share the feeling")}
        {toggle("old", "Also share what I usually do")}
        {toggle("gap", "Also share what makes it hard")}
      </div>

      <div className="mt-6">
        <ShareSend message={message} to={to} email={person?.email} kind="plan" toggles={t} doneHref="/dashboard?setup=done" disabled={!to} />
      </div>

      {mentees.length > 0 && plan && (
        <details className="mt-6 text-sm">
          <summary className="cursor-pointer text-link font-medium">Tell {mentees[0].name.split(" ")[0]}, my mentee, what I&apos;m working on (optional)</summary>
          <p className="mt-2 rounded-2xl bg-ink/[0.04] px-4 py-3 text-[15px]">{menteeMessage(plan)}</p>
          <div className="mt-2"><ShareSend message={menteeMessage(plan)} to={mentees[0].id} email={mentees[0].email} kind="mentee" label={`Send to ${mentees[0].name.split(" ")[0]}`} className="btn-quiet" /></div>
        </details>
      )}
    </div>
  );
}
