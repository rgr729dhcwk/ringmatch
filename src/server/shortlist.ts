import { buildDeck, type Card } from "@/lib/card";
import { computeShortlist, TIER_IDS, validateLayout, type ShortlistEntry, type ShortlistLayout, type TierId } from "@/lib/shortlist";
import type { SwipeAction } from "@/lib/taxonomy";
import { effectiveInteractions } from "@/recs/preferenceVector";
import { db } from "./db";

export type ShortlistItem = ShortlistEntry & { card: Card };
export type Shortlist = Record<TierId, ShortlistItem[]>;

async function currentEntries(userId: string) {
  const [interactions, rows] = await Promise.all([
    db.interaction.findMany({
      where: { userId },
      select: { id: true, action: true, undoesId: true, listingId: true, createdAt: true },
    }),
    db.shortlistOrder.findMany({ where: { userId } }),
  ]);
  const swipes = effectiveInteractions(interactions).map((i) => ({
    listingId: i.listingId,
    action: i.action as SwipeAction,
    createdAt: i.createdAt,
  }));
  return { entries: computeShortlist(swipes, rows), rows };
}

/** The user's shortlist with full cards. New arrivals get an order row saved. */
export async function loadShortlist(userId: string): Promise<Shortlist> {
  const { entries } = await currentEntries(userId);
  const all = TIER_IDS.flatMap((t) => entries[t]);

  // Persist order rows for new arrivals and re-numbered ranks.
  await db.$transaction(
    all.map((e) =>
      db.shortlistOrder.upsert({
        where: { userId_listingId: { userId, listingId: e.listingId } },
        create: { userId, listingId: e.listingId, tier: e.tier, rank: e.rank },
        update: { tier: e.tier, rank: e.rank, removedAt: null },
      }),
    ),
  );

  const listings = await db.listing.findMany({
    where: { id: { in: all.map((e) => e.listingId) } },
    include: { images: { orderBy: { position: "asc" } }, videos: { orderBy: { position: "asc" } } },
  });
  // Cards only via buildDeck(): anything without a guaranteed visual is left out.
  const cardBy = new Map(buildDeck(listings).map((c) => [c.id, c]));
  const out = {} as Shortlist;
  for (const t of TIER_IDS) {
    out[t] = entries[t].flatMap((e) => {
      const card = cardBy.get(e.listingId);
      return card ? [{ ...e, isNew: false, card }] : [];
    });
  }
  return out;
}

export async function shortlistCount(userId: string): Promise<number> {
  const { entries } = await currentEntries(userId);
  return TIER_IDS.reduce((n, t) => n + entries[t].length, 0);
}

/** Save a rearrangement. Returns false if it isn't exactly the current shortlist. */
export async function saveLayout(userId: string, layout: unknown): Promise<boolean> {
  const { entries } = await currentEntries(userId);
  const valid: ShortlistLayout | null = validateLayout(layout, entries);
  if (!valid) return false;
  await db.$transaction(
    TIER_IDS.flatMap((tier) =>
      valid[tier].map((listingId, rank) =>
        db.shortlistOrder.upsert({
          where: { userId_listingId: { userId, listingId } },
          create: { userId, listingId, tier, rank },
          update: { tier, rank, removedAt: null },
        }),
      ),
    ),
  );
  return true;
}

/** Take a ring off the shortlist (doesn't count as disliking it). */
export async function removeFromShortlist(userId: string, listingId: string): Promise<boolean> {
  const res = await db.shortlistOrder.updateMany({
    where: { userId, listingId, removedAt: null },
    data: { removedAt: new Date() },
  });
  return res.count > 0;
}
