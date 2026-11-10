import { getCurrentUser } from "@/lib/auth";
import { developmentSummary } from "@/lib/summary";

export async function GET() {
  const u = await getCurrentUser();
  if (!u || u.role !== "PARTICIPANT") return new Response("Unauthorized", { status: 401 });
  const md = await developmentSummary(u.id, u.name);
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="development-summary.md"`,
      "Cache-Control": "no-store",
    },
  });
}
