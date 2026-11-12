import { notFound } from "next/navigation";
import { CardVisual } from "@/components/deck/CardVisual";
import { toCard } from "@/lib/card";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Dev-only: render one listing's visual large, e.g. /dev/ring?id=sample-007 */
export default async function DevRing({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { id } = await searchParams;
  const row = await db.listing.findFirst({ where: { externalId: id ?? "sample-001" }, include: { images: true } });
  const card = row && toCard(row);
  if (!card) notFound();
  return (
    <main className="mx-auto max-w-md p-3">
      <div className="aspect-square overflow-hidden rounded-3xl">
        <CardVisual visual={card.visual} title={card.title} live />
      </div>
      <p className="mt-2 text-sm">{card.title}</p>
    </main>
  );
}
