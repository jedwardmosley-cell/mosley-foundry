import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canCoach } from "@/lib/roles";
import { CLIENT_GUIDE, COACH_GUIDE, ADMIN_GUIDE, GUIDE_STATUS, type GuideSection } from "@/content/guide";
import { PageHeader, Draft } from "@/components/ui";

export const metadata = { title: "Guide" };

function Sections({ prefix, sections }: { prefix: string; sections: GuideSection[] }) {
  return (
    <div className="space-y-3">
      {sections.map((s, i) => (
        <details key={s.id} id={`${prefix}-${s.id}`} className="card group scroll-mt-20" open={i === 0}>
          <summary className="cursor-pointer list-none flex items-center gap-3">
            <span className="font-serif text-xl text-brass w-7 shrink-0">{i + 1}</span>
            <span className="flex-1">
              <span className="h3 block">{s.title}</span>
              {s.time && <span className="text-xs text-ink-mute">{s.time}</span>}
            </span>
            <span aria-hidden className="text-ink-mute group-open:rotate-90 transition-transform">›</span>
          </summary>
          <div className="mt-4">
            {s.intro && <p className="text-[15px] leading-relaxed mb-3">{s.intro}</p>}
            <ol className="list-decimal pl-5 space-y-2 text-[15px] leading-relaxed">
              {s.steps.map((t) => <li key={t}>{t}</li>)}
            </ol>
            {s.note && <p className="mt-3 rounded-xl bg-paper p-3 text-sm text-ink-soft">{s.note}</p>}
            {s.link && <Link href={s.link.href} className="btn-quiet mt-4">{s.link.label}</Link>}
          </div>
        </details>
      ))}
    </div>
  );
}

export default async function GuidePage() {
  const u = await requireUser();
  const coach = canCoach(u);
  return (
    <>
      <PageHeader eyebrow="How to use the app" title="Guide">
        Short steps for each part of the app. Tap a section to open it.
        {GUIDE_STATUS === "draft" && <span className="ml-2"><Draft>Draft guide</Draft></span>}
      </PageHeader>

      {u.role === "PARTICIPANT" && <Sections prefix="client" sections={CLIENT_GUIDE} />}

      {u.role === "ADMIN" && (
        <>
          <h2 className="h2 mb-3">For administrators</h2>
          <Sections prefix="admin" sections={ADMIN_GUIDE} />
        </>
      )}

      {coach && (
        <>
          <h2 className={`h2 mb-3 ${u.role === "ADMIN" ? "mt-10" : ""}`}>For coaches</h2>
          <Sections prefix="coach" sections={COACH_GUIDE} />
        </>
      )}

      {u.role !== "PARTICIPANT" && (
        <>
          <h2 className="h2 mt-10 mb-1">What your clients see</h2>
          <p className="muted text-[15px] mb-3">This is the guide your clients get, so you can point them to the right step.</p>
          <Sections prefix="client" sections={CLIENT_GUIDE.map((s) => ({ ...s, link: undefined }))} />
        </>
      )}
    </>
  );
}
