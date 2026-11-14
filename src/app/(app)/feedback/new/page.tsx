import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getContent } from "@/content";
import { PageHeader, Card } from "@/components/ui";
import { FeedbackForm } from "@/components/FeedbackForm";

export const metadata = { title: "Add feedback" };

export default async function NewFeedback() {
  await requireUser("PARTICIPANT");
  const { pack } = await getContent();
  return (
    <>
      <Link href="/feedback" className="text-sm btn-link">My feedback</Link>
      <PageHeader title="Add feedback" />
      <Card><FeedbackForm pillarNames={Object.fromEntries(pack.pillars.map((p) => [p.key, p.name]))} /></Card>
    </>
  );
}
