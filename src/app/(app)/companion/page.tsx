import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiAvailable, purgeExpired } from "@/lib/ai";
import { startConversation } from "@/app/actions/ai";
import { fmt } from "@/lib/dates";
import { PageHeader, Card } from "@/components/ui";

export const metadata = { title: "AI Companion" };

const MODES = [
  { mode: "COACH", title: "Think it through", text: "Examine a decision, a pattern, or an obstacle. Design a small experiment for this week." },
  { mode: "PRACTICE", title: "Practice a hard conversation", text: "Rehearse with a realistic counterpart, then get feedback on what landed." },
  { mode: "SESSION_PREP", title: "Prepare for coaching", text: "Get ready for your next session with your human coach." },
];

export default async function CompanionHome() {
  const u = await requireUser("PARTICIPANT");
  await purgeExpired(u.id);
  const [convos, profile] = await Promise.all([
    db.aiConversation.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
    db.profile.findUnique({ where: { userId: u.id } }),
  ]);
  const on = aiAvailable() && profile?.aiEnabled !== false;
  return (
    <>
      <PageHeader eyebrow="Reinforcement, not replacement" title="AI Coaching Companion">
        Grounded in the book, the workbook and your own recorded goals. It cites where its program content comes from, keeps what you recorded separate from its suggestions, and points you back to the people in your corner. It cannot see your private journal. It is not a therapist.
      </PageHeader>
      {!aiAvailable() && <Card className="mb-5"><p className="text-sm">The companion is not configured on this server. An administrator needs to set <code>ANTHROPIC_API_KEY</code>.</p></Card>}
      {profile?.aiEnabled === false && <Card className="mb-5"><p className="text-sm">You turned the companion off. <Link className="btn-link" href="/settings">Settings</Link></p></Card>}
      <div className="grid gap-4 sm:grid-cols-3">
        {MODES.map((m) => (
          <form key={m.mode} action={startConversation} className="card flex flex-col">
            <input type="hidden" name="mode" value={m.mode} />
            <h2 className="h3">{m.title}</h2>
            <p className="text-sm muted mt-1 flex-1">{m.text}</p>
            <button className="btn-primary mt-4" disabled={!on}>Start</button>
          </form>
        ))}
      </div>
      {convos.length > 0 && (
        <Card className="mt-6">
          <p className="eyebrow">Conversations</p>
          <ul className="mt-2 divide-y divide-line">
            {convos.map((c) => (
              <li key={c.id} className="py-2.5 flex justify-between gap-3">
                <Link href={`/companion/${c.id}`} className="btn-link truncate">{c.title}</Link>
                <span className="text-xs muted shrink-0">{fmt(c.createdAt)} · deletes {fmt(c.expiresAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
