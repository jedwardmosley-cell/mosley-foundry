import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SHARE_SCOPES } from "@/lib/access";
import { setShare } from "@/app/actions/participant";
import { PageHeader, Card, Empty } from "@/components/ui";

export const metadata = { title: "Sharing" };

export default async function SharingPage() {
  const u = await requireUser("PARTICIPANT");
  const [coaches, grants] = await Promise.all([
    db.coachAssignment.findMany({ where: { participantId: u.id, active: true }, include: { coach: { select: { id: true, name: true } } } }),
    db.shareGrant.findMany({ where: { ownerId: u.id } }),
  ]);
  return (
    <>
      <PageHeader eyebrow="You decide" title="What your coach can see">
        Being assigned a coach shares nothing. Turn on only what you want them to see. Your private journal and AI conversations are never shareable. Your organization and program sponsor never see individual development records.
      </PageHeader>
      {coaches.length === 0 && <Empty title="No coach assigned">When a coach is assigned to you, you can choose what to share here.</Empty>}
      {coaches.map((c) => (
        <Card key={c.id} className="mb-4">
          <h2 className="h2">{c.coach.name}</h2>
          <ul className="mt-4 divide-y divide-line">
            {(Object.entries(SHARE_SCOPES) as [keyof typeof SHARE_SCOPES, string][]).map(([scope, label]) => {
              const on = grants.some((g) => g.granteeId === c.coach.id && g.scope === scope);
              return (
                <li key={scope} className="py-3 flex items-center justify-between gap-4">
                  <span className="text-[15px]">{label}</span>
                  <form action={setShare}>
                    <input type="hidden" name="coachId" value={c.coach.id} />
                    <input type="hidden" name="scope" value={scope} />
                    <input type="hidden" name="on" value={on ? "false" : "true"} />
                    <button aria-pressed={on} aria-label={`${on ? "Stop sharing" : "Share"}: ${label}`} className={`relative h-7 w-12 rounded-full transition-colors ${on ? "bg-navy" : "bg-line"}`}>
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-surface shadow transition-all ${on ? "left-6" : "left-1"}`} />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-mute">Reflections need two things: this switch on, and the individual entry marked as shared.</p>
        </Card>
      ))}
    </>
  );
}
