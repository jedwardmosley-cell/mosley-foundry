import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCohort } from "@/app/actions/admin";
import { DELIVERY_FORMATS } from "@/content/program";
import { fmt, ymd } from "@/lib/dates";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/Submit";

export const metadata = { title: "Programs" };

export default async function AdminHome() {
  const a = await requireUser("ADMIN");
  const org = a.orgId ? await db.organization.findUnique({ where: { id: a.orgId } }) : null;
  const cohorts = await db.cohort.findMany({ where: { orgId: a.orgId ?? "__none__" }, orderBy: { startDate: "desc" }, include: { _count: { select: { members: true } } } });
  return (
    <>
      <PageHeader eyebrow={org?.name ?? "Organization"} title="Programs and cohorts">
        Sponsors and administrators manage enrollment, schedules and attendance and see group reporting. Individual journals, EQ-i results, reflections and coaching conversations are not available here.
      </PageHeader>
      <div className="space-y-3">
        {cohorts.map((c) => (
          <Link key={c.id} href={`/admin/cohorts/${c.id}`} className="card block hover:border-navy/40">
            <div className="flex justify-between gap-3"><h2 className="h3">{c.name}</h2><span className="text-sm muted">{c._count.members} enrolled</span></div>
            <p className="text-sm muted mt-1">Leading Others · {DELIVERY_FORMATS[c.deliveryFormat as keyof typeof DELIVERY_FORMATS].label} · starts {fmt(c.startDate, { month: "long", day: "numeric", year: "numeric" })}</p>
          </Link>
        ))}
      </div>
      <Card className="mt-6">
        <h2 className="h3">New cohort: Leading Others program</h2>
        <form action={createCohort} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input name="name" required className="input" /></Field>
          <Field label="First segment date"><input type="date" name="startDate" required defaultValue={ymd()} className="input" /></Field>
          <Field label="Delivery format">
            <select name="deliveryFormat" className="input">{Object.entries(DELIVERY_FORMATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          </Field>
          <Field label="Reinforcement period (days)" hint="At least 30."><input type="number" name="reinforceDays" min={30} max={180} defaultValue={30} className="input" /></Field>
          <div className="sm:col-span-2"><Submit>Create cohort</Submit><p className="text-xs text-ink-mute mt-2">A default schedule is generated (mornings 9:00, afternoons 1:00). Edit every slot on the next screen.</p></div>
        </form>
      </Card>
    </>
  );
}
