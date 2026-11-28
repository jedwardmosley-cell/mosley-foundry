import Link from "next/link";
import { db } from "@/lib/db";
import { startDistance } from "@/app/actions/distance";
import { Submit } from "./Submit";
import { positionWord, RULE_ORDER } from "@/lib/distance";

/**
 * Start the distance check, or pick it up where it was left. Used on the Rules of the Road and in setup.
 * After a finished check, it shows their answer for each rule and offers a fresh one.
 */
export async function DistanceStart({ userId, from, next }: { userId: string; from?: "start"; next?: string }) {
  const [open, last] = await Promise.all([
    db.distanceRun.findFirst({ where: { userId, completedAt: null }, orderBy: { startedAt: "desc" }, include: { rules: { select: { position: true } } } }),
    db.distanceRun.findFirst({ where: { userId, completedAt: { not: null } }, orderBy: { completedAt: "desc" }, include: { rules: { select: { pillar: true, position: true } } } }),
  ]);
  const begun = open?.rules.some((r) => r.position != null);
  return (
    <section className="card">
      {last && (
        <div className="mb-5">
          <p className="section-label">Last time</p>
          <ul className="mt-2 grid gap-1 text-[15px] sm:grid-cols-2">
            {RULE_ORDER.map((k) => <li key={k}><span className="text-ink-mute">{k}:</span> {positionWord(last.rules.find((r) => r.pillar === k)?.position)}</li>)}
          </ul>
          <Link href={`/assessment/check/${last.id}/done`} className="mt-2 inline-block text-sm btn-link">See it</Link>
        </div>
      )}
      <form action={startDistance}>
        {from && <input type="hidden" name="from" value={from} />}
        {next && <input type="hidden" name="next" value={next} />}
        <Submit className="btn-primary">{begun ? "Pick up where I left off" : last ? "Take it again" : "Start: where am I?"}</Submit>
        {last && !begun && <p className="mt-2 text-sm text-ink-mute">With fresh situations. At the end you&apos;ll see how each rule moved.</p>}
      </form>
    </section>
  );
}
