import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

const GROUPS: [string, [string, string, string][]][] = [
  ["FORGE", [
    ["/identity", "1. Who's behind the wheel", "The FORGE framework, applied to you: your seat, how big a turn, the five rules of one driver, and My statement."],
    ["/assessment", "2. Where I am", "Score the five rules. The goal is a 5 on every one."],
    ["/tone", "Set the Tone", "Language with power: what you tell yourself, and how to say it to someone else. Private."],
  ]],
  ["Discipline by Design", [
    ["/focus", "3. My focus", "One or two things to work on, each with a plan for 30 days. That's it."],
    ["/road", "4. My Design", "Discipline by Design: the routines and people that build your focus into your week."],
    ["/season", "Season", "Three rounds of 30 days, about 90 days, and the review at the end."],
    ["/reflect", "Weekly look back", "Did I do what I said I was going to do?"],
  ]],
  ["Support", [
    ["/coaching", "Coaching", "Sessions and exercises from your coach."],
    ["/network", "People", "Log check-ins with the people on your road."],
    ["/companion", "Help me with this", "Think it through, practice a hard conversation, prepare for coaching."],
    ["/pathway", "My pathway", "Program segments and work for your pathway."],
    ["/feedback", "My feedback", "Your own summary of a 360 or an EQ-i debrief, connected to FORGE. Private unless you share it."],
    ["/library", "Library", "The FORGE Framework: the five rules for the road, and how to put each one into practice."],
  ]],
  ["Mine", [
    ["/journal", "Private journal", "Private to you and never shared."],
    ["/history", "History & export", "Your development over time."],
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
