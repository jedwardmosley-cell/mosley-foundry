import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { grantedScopes, audit } from "@/lib/access";

/**
 * The file a client attached to a My feedback entry. The client can always open it. Their coach can
 * open it only when the client shared that entry and the My feedback scope. No one else, ever.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const f = await db.feedback.findUnique({ where: { id }, select: { userId: true, shareCoach: true, fileName: true, fileType: true, fileData: true } });
  if (!f?.fileData) return new Response("Not found", { status: 404 });
  if (f.userId !== user.id) {
    const scopes = await grantedScopes(user, f.userId);
    if (!f.shareCoach || !scopes.has("FEEDBACK")) return new Response("Not found", { status: 404 });
    await audit(user, "coach.feedback_file", f.userId, id);
  }
  const name = (f.fileName ?? "feedback").replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(f.fileData), {
    headers: {
      "Content-Type": f.fileType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
