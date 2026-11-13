import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteConversation } from "@/app/actions/ai";
import { fmt } from "@/lib/dates";
import { Chat } from "@/components/Chat";

export default async function Conversation({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("PARTICIPANT");
  const { id } = await params;
  const c = await db.aiConversation.findFirst({ where: { id, userId: u.id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!c) notFound();
  const starter = {
    COACH: "What's on the road in front of you right now?",
    PRACTICE: "Who is the conversation with, and what do you need it to accomplish?",
    SESSION_PREP: "When is your next coaching session, and what did you commit to last time?",
  }[c.mode as "COACH" | "PRACTICE" | "SESSION_PREP"];
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h1 className="h2 truncate">{c.title}</h1>
        <form action={deleteConversation}><input type="hidden" name="id" value={c.id} /><button className="text-sm text-ink-mute hover:text-alert">Delete</button></form>
      </div>
      <p className="text-xs text-ink-mute mb-4">Kept until {fmt(c.expiresAt, { month: "long", day: "numeric" })}. Not visible to your coach or organization.</p>
      <Chat id={c.id} starter={starter} messages={c.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, citations: JSON.parse(m.citations) as { id: string; ref: string }[] }))} />
    </div>
  );
}
