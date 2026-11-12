import { z } from "zod";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

const Body = z.object({ interactionId: z.string().min(1) });

/** Undo a swipe: appends an "undo" row pointing at the cancelled one. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "no profile" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const target = await db.interaction.findUnique({ where: { id: parsed.data.interactionId }, include: { undoneBy: true } });
  if (!target || target.userId !== user.id) return Response.json({ error: "not found" }, { status: 404 });
  if (target.action === "undo") return Response.json({ error: "cannot undo an undo" }, { status: 400 });
  if (target.undoneBy) return Response.json({ id: target.undoneBy.id }, { status: 200 });
  const row = await db.interaction.create({
    data: { userId: user.id, listingId: target.listingId, action: "undo", undoesId: target.id },
  });
  return Response.json({ id: row.id }, { status: 201 });
}
