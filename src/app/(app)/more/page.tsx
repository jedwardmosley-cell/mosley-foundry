import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

const LINKS = [
  ["/assessment", "FORGE Assessment", "Score all five pillars. Revise after reading the anchors."],
  ["/blueprint", "Discipline by Design Blueprint", "Routines, people, learning and review."],
  ["/reflect", "Weekly Reflection", "Did I do what I said I was going to do?"],
  ["/pathway", "My Pathway", "Program segments and pathway-specific work."],
  ["/library", "Road Library", "Book prompts, Road Tests and workbook exercises."],
  ["/companion", "AI Companion", "Reflect, practice a hard conversation, prepare for coaching."],
  ["/coaching", "Coaching", "Sessions and exercises from your coach."],
  ["/journal", "Private Journal", "Private to you and never shared."],
  ["/history", "History & Export", "Your development over time."],
  ["/sharing", "Sharing", "Choose what your coach can see."],
  ["/settings", "Settings", "Reminders and AI retention."],
];

export default async function MorePage() {
  await requireUser("PARTICIPANT");
  return (
    <>
      <PageHeader title="More" />
      <ul className="card !p-0 divide-y divide-line">
        {LINKS.map(([href, label, hint]) => (
          <li key={href}><Link href={href} className="block px-5 py-4 hover:bg-paper"><span className="font-medium">{label}</span><span className="block text-sm muted">{hint}</span></Link></li>
        ))}
      </ul>
    </>
  );
}
