import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

const GROUPS: [string, [string, string, string][]][] = [
  ["My journey", [
    ["/identity", "1. Who I am", "Claim it in an I am statement and choose how big a change it is."],
    ["/plan", "2. FORGE identity", "Five I am statements, one for each letter, then your FORGE Statement."],
    ["/assessment", "3. Where I am today", "Score the five pillars and pick one to work on."],
    ["/blueprint", "4. My road", "Discipline by Design: your routines, your people, your learning."],
    ["/cycle", "5. 30 days", "Practice one behavior for 30 days, then decide what is next."],
    ["/reflect", "Weekly reflection", "Did I do what I said I was going to do?"],
  ]],
  ["Support", [
    ["/coaching", "Coaching", "Sessions and exercises from your coach."],
    ["/network", "People", "Log check-ins with the people on your road."],
    ["/companion", "AI Companion", "Think it through, practice a hard conversation, prepare for coaching."],
    ["/pathway", "My Pathway", "Program segments and work for your pathway."],
    ["/pathway/eqi", "EQ-i priorities", "Optional. For people who have had an EQ-i debrief."],
    ["/library", "Road Library", "Book prompts, Road Tests and workbook exercises."],
  ]],
  ["Mine", [
    ["/journal", "Private Journal", "Private to you and never shared."],
    ["/history", "History & Export", "Your development over time."],
    ["/sharing", "Sharing", "Choose what your coach can see."],
    ["/guide", "Guide", "Short steps for each part of the app."],
    ["/account/password", "Change password", "Pick a new password for your account."],
    ["/settings", "Settings", "Reminders and AI retention."],
  ]],
];

export default async function MorePage() {
  await requireUser("PARTICIPANT");
  return (
    <>
      <PageHeader title="More" />
      {GROUPS.map(([title, links]) => (
        <section key={title} className="mb-6">
          <h2 className="eyebrow mb-2">{title}</h2>
          <ul className="card !p-0 divide-y divide-line">
            {links.map(([href, label, hint]) => (
              <li key={href}><Link href={href} className="block px-5 py-4 hover:bg-paper"><span className="font-medium">{label}</span><span className="block text-sm muted">{hint}</span></Link></li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
