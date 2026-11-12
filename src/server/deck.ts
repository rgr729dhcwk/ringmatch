import { buildDeck, type Card } from "@/lib/card";
import { orderDeck } from "@/recs/deckOrder";
import { effectiveInteractions } from "@/recs/preferenceVector";
import { db } from "./db";

/** Listing ids the user has already swiped (ignoring undone swipes). */
export async function seenListingIds(userId: string): Promise<Set<string>> {
  const rows = await db.interaction.findMany({
    where: { userId },
    select: { id: true, action: true, undoesId: true, listingId: true },
  });
  return new Set(effectiveInteractions(rows).map((r) => r.listingId));
}

export async function getDeckForUser(userId: string, opts: { includeSeen?: boolean } = {}): Promise<{ cards: Card[]; total: number }> {
  const rows = await db.listing.findMany({
    where: { active: true },
    include: { images: { orderBy: { position: "asc" } } },
  });
  const seen = opts.includeSeen ? new Set<string>() : await seenListingIds(userId);
  const all = buildDeck(rows); // drops anything without a guaranteed visual
  const unseen = all.filter((c) => !seen.has(c.id));
  const shapeOf = new Map(rows.map((r) => [r.id, r.shape]));
  const ordered = orderDeck(
    unseen.map((c) => ({ ...c, shape: shapeOf.get(c.id) ?? null })),
    userId,
  ).map(({ shape: _shape, ...c }) => c as Card);
  return { cards: ordered, total: all.length };
}
