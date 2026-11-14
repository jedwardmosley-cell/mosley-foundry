import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getForgeSource } from "@/content/forgeSource";
import { FORGE_LINES } from "@/content/forgeLines";
import { asRole } from "@/content/whoIAm";
import { examplePlaceholder, exampleGroups, IDENTITY_EXAMPLES_STATUS } from "@/content/identityExamples";
import type { PathwayKey } from "@/content/program";
import type { PillarKey } from "@/content/types";
import { aiAvailable } from "@/lib/ai";
import { saveWhoIAm } from "@/app/actions/identity";
import { PillarMark, PILLAR_FILL } from "@/components/ui";
import { PrefixedBox } from "@/components/PrefixedBox";
import { Picks } from "@/components/Picks";
import { IdentityCoach } from "@/components/IdentityCoach";
import { Submit } from "@/components/Submit";
import { Icon } from "@/components/Icon";

export const metadata = { title: "FORGE" };

const ORDER: PillarKey[] = ["F", "O", "R", "G", "E"];

/**
 * One FORGE rule per screen. It teaches before it asks: the rule, what it means, a picture from
 * the road, why it works, how it connects, the book's questions, then the client's I am line.
 * Every word of teaching comes from forge-source.md.
 */
export default async function ForgeCardPage({ params, searchParams }: { params: Promise<{ letter: string }>; searchParams: Promise<{ saved?: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { letter } = await params;
  const { saved } = await searchParams;
  const key = letter.toUpperCase() as PillarKey;
  if (!ORDER.includes(key)) notFound();
  const line = FORGE_LINES.find((l) => l.pillar === key)!;
  const [profile, identity, src] = await Promise.all([
    db.profile.findUnique({ where: { userId: u.id } }),
    db.identityProfile.findUnique({ where: { userId: u.id } }),
    getForgeSource(),
  ]);
  const card = src?.cards[key];
  const pathway = (profile?.pathway ?? "PERSONAL") as PathwayKey;
  const role = identity?.role ?? "";
  const level = identity?.level ?? "";
  const mine = profile?.[line.field] ?? "";
  const returning = !!mine;
  const ai = aiAvailable() && profile?.aiEnabled !== false;
  const n = ORDER.indexOf(key) + 1;
  const next = ORDER[n] ? `/forge/${ORDER[n].toLowerCase()}` : "/identity";
  // The screen takes the pillar's color. Progress stays navy.
  const tone = { "--pc": `var(${PILLAR_FILL[key].cssVar})` } as CSSProperties;

  return (
    <article style={tone} className="pb-4">
      <p className="text-sm text-ink-mute"><span className="font-medium text-heading">{n} of 5</span> · FORGE</p>
      <div className="mt-2 flex gap-1" aria-hidden>
        {ORDER.map((k, i) => <span key={k} className={`h-1 flex-1 rounded-full ${i < n ? "bg-navy" : "bg-ink/[0.08]"}`} />)}
      </div>

      {/* 1. The rule */}
      <header className="mt-8">
        <PillarMark k={key} size="lg" />
        <h1 className="mt-4 h1">{line.label}</h1>
        <p className="mt-2 font-serif text-[22px] leading-snug" style={{ color: "rgb(var(--pc))" }}>{card?.rule || "Know the rule."}</p>
      </header>

      {card && (
        <div className="mt-8 space-y-7 text-[16px] leading-relaxed text-ink">
          {/* 2. What it means: open the first time, folded once the client has written their line. */}
          {returning ? (
            <details className="group">
              <summary className="cursor-pointer text-link font-medium">What it means</summary>
              <p className="mt-3">{card.means}</p>
            </details>
          ) : (
            <section>
              <h2 className="section-label">What it means</h2>
              <p className="mt-2">{card.means}</p>
            </section>
          )}

          {/* 3. From the road */}
          <section className="rounded-[22px] px-5 py-5" style={{ background: "rgb(var(--pc) / 0.07)" }}>
            <h2 className="section-label flex items-center gap-2"><Icon name="step" className="h-4 w-4" />From the road</h2>
            <p className="mt-2 font-serif text-[18px] leading-[1.5] text-heading">{card.road}</p>
            {card.roadMore && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-link font-medium">Read the rest</summary>
                <p className="mt-2 font-serif text-[18px] leading-[1.5] text-heading">{card.roadMore}</p>
              </details>
            )}
          </section>

          {/* 4. Why it works */}
          <section>
            <h2 className="section-label">Why it works</h2>
            <p className="mt-2">{card.why}</p>
            <Link href={`/forge/${key.toLowerCase()}/guide#why`} className="mt-2 inline-block text-sm btn-link">Read more</Link>
          </section>

          {/* 5. How it connects */}
          <section className="flex gap-3 border-t border-line/60 pt-5">
            <Icon name="target" className="mt-0.5 h-5 w-5 shrink-0 text-ink-mute" />
            <p className="text-[15px] text-ink-soft">{card.connects}</p>
          </section>

          {/* 6. Before you write */}
          <section className="border-t border-line/60 pt-5">
            <h2 className="section-label">Before you write</h2>
            {card.beforeIntro && <p className="mt-2">{card.beforeIntro}</p>}
            <ul className="mt-3 space-y-2">
              {card.before.map((q) => (
                <li key={q} className="flex gap-3"><span aria-hidden className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "rgb(var(--pc))" }} /><span>{q}</span></li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* 7. The client's I am line */}
      <form action={saveWhoIAm} className="mt-9 card space-y-3">
        <input type="hidden" name="next" value={key === "F" ? "/forge/f?saved=1" : next} />
        <label htmlFor={line.field} className="block font-serif text-[22px] leading-snug text-heading">{asRole(line.question, role)}</label>
        <PrefixedBox name={line.field} prefix={line.prefix} saved={mine} placeholder="" />
        <p className="text-sm text-ink-soft">For example: <span className="font-serif text-[16px] text-heading">I am {examplePlaceholder(line.field, pathway, role, level)}</span></p>
        <div className="relative">
          <Picks list={{ status: IDENTITY_EXAMPLES_STATUS, options: [] }} groups={exampleGroups(line.field, pathway, role, level).slice(1)} target={line.field} folded="More examples" alignRight={ai} />
          {ai && <IdentityCoach field={line.field} prefix={line.prefix} corner />}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
          <Submit>{saved ? "Saved" : "Save my F line"}</Submit>
          <Link href={`/forge/${key.toLowerCase()}/guide`} className="text-sm btn-link">Read the full guide</Link>
        </div>
      </form>
    </article>
  );
}
