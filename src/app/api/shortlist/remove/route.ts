import { z } from "zod";
import { getCurrentUser } from "@/server/session";
import { removeFromShortlist } from "@/server/shortlist";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "no profile" }, { status: 401 });
  const parsed = z.object({ listingId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "listingId required" }, { status: 400 });
  const ok = await removeFromShortlist(user.id, parsed.data.listingId);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
