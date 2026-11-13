import { z } from "zod";
import { SWIPE_ACTIONS } from "@/lib/taxonomy";
import { db } from "@/server/db";
import { getPartnerContext, matchAfterSwipe } from "@/server/couple";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

const Body = z.object({ listingId: z.string().min(1), action: z.enum(SWIPE_ACTIONS) });

/** Record a swipe. Append-only. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "no profile" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const listing = await db.listing.findUnique({ where: { id: parsed.data.listingId }, select: { id: true } });
  if (!listing) return Response.json({ error: "unknown listing" }, { status: 404 });
  const partner = await getPartnerContext(user.id);
  const row = await db.interaction.create({
    data: { userId: user.id, listingId: listing.id, action: parsed.data.action, coupleId: partner?.linked ? partner.coupleId : null },
  });
  const match = await matchAfterSwipe(user.id, listing.id, parsed.data.action);
  return Response.json({ id: row.id, match }, { status: 201 });
}

/** The current profile's interaction log (newest first). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "no profile" }, { status: 401 });
  const rows = await db.interaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, listingId: true, action: true, undoesId: true, createdAt: true },
    take: 500,
  });
  return Response.json({ interactions: rows });
}
