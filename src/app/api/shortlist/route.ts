import { getCurrentUser } from "@/server/session";
import { loadShortlist, saveLayout } from "@/server/shortlist";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "no profile" }, { status: 401 });
  return Response.json(await loadShortlist(user.id));
}

/** Body: { layout: { top: [ids], strong: [ids], maybe: [ids] } } — must be a rearrangement of the current list. */
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "no profile" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { layout?: unknown } | null;
  const ok = await saveLayout(user.id, body?.layout);
  if (!ok) return Response.json({ error: "layout doesn't match your shortlist" }, { status: 409 });
  return Response.json({ ok: true });
}
