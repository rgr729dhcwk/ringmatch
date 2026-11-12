import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const listings = await db.listing.count({ where: { active: true } });
  return Response.json({ ok: true, listings });
}
