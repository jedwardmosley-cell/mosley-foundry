import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { approveUser, declineUser, setUserActive } from "@/app/actions/admin";
import { fmt } from "@/lib/dates";
import { PageHeader, Card, Empty } from "@/components/ui";

export const metadata = { title: "People" };

const ROLE: Record<string, string> = { PARTICIPANT: "Client", COACH: "Coach", ADMIN: "Administrator" };
const STATUS: Record<string, string> = { ACTIVE: "Active", PENDING: "Waiting", DECLINED: "Declined", DISABLED: "Turned off" };

/**
 * Who can get in. Sign-ups wait here until an administrator approves them.
 * Shows names, emails, roles and status only: no development data of any kind.
 */
export default async function People() {
  const a = await requireUser("ADMIN");
  const org = a.orgId ?? "__none__";
  const [waiting, people] = await Promise.all([
    db.user.findMany({ where: { status: "PENDING", isDemo: false, OR: [{ orgId: null }, { orgId: org }] }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, createdAt: true } }),
    db.user.findMany({
      where: { status: { not: "PENDING" }, OR: [{ orgId: org }, { orgId: null, status: "DECLINED" }] },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, status: true, isDemo: true, approvedBy: true, coaching: { where: { active: true }, select: { coach: { select: { name: true } } } } },
    }),
  ]);
  const plain = (n: string) => n.split(" (")[0];

  return (
    <>
      <PageHeader eyebrow="Administration" title="People">
        Who can sign in. New sign-ups wait here for your approval. Accounts a coach adds, people you enroll, and partners invited by a client come straight in.
      </PageHeader>

      <section className="mb-10">
        <h2 className="h2 mb-3">Waiting for approval</h2>
        {waiting.length === 0 ? (
          <Empty title="No one is waiting">New sign-ups show up here, and you&apos;ll get an email when email is set up.</Empty>
        ) : (
          <ul className="space-y-3">
            {waiting.map((u) => (
              <li key={u.id}>
                <Card className="!py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[16px] font-medium text-heading">{u.name}</p>
                      <p className="text-sm text-ink-soft break-all">{u.email}, asked {fmt(u.createdAt, { month: "short", day: "numeric" })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={approveUser}><input type="hidden" name="userId" value={u.id} /><button className="btn-primary !px-5 !py-2 text-sm">Approve</button></form>
                      <form action={declineUser}><input type="hidden" name="userId" value={u.id} /><button className="btn-quiet !px-5 !py-2 text-sm">Decline</button></form>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="h2 mb-1">Everyone</h2>
        <p className="mb-4 text-sm text-ink-soft">Turning an account off signs the person out everywhere and stops them signing in. Nothing they saved is removed, and you can turn it back on.</p>
        <div className="card !p-0 divide-y divide-line/60">
          {people.map((u) => {
            const coaches = u.coaching.map((c) => plain(c.coach.name));
            const self = u.id === a.id;
            return (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-heading">{plain(u.name)}{u.isDemo && <span className="ml-2 chip">Demo</span>}</p>
                  <p className="text-sm text-ink-soft break-all">
                    {u.email}, {ROLE[u.role] ?? u.role}{coaches.length ? `, coach: ${coaches.join(", ")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`chip ${u.status === "ACTIVE" ? "" : "!text-alert"}`}>{STATUS[u.status] ?? u.status}</span>
                  {!self && u.role !== "ADMIN" && u.status === "ACTIVE" && (
                    <form action={setUserActive}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="on" value="false" /><button className="text-sm text-ink-mute hover:text-alert">Turn off</button></form>
                  )}
                  {u.status === "DISABLED" && (
                    <form action={setUserActive}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="on" value="true" /><button className="text-sm btn-link">Turn back on</button></form>
                  )}
                  {u.status === "DECLINED" && (
                    <form action={approveUser}><input type="hidden" name="userId" value={u.id} /><button className="text-sm btn-link">Approve after all</button></form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
