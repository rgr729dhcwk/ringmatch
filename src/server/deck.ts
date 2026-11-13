import { buildDeck, type Card } from "@/lib/card";
import { effectiveInteractions } from "@/recs/preferenceVector";
import { rankDeck } from "@/recs/rank";
import { db } from "./db";
import { getPartnerContext } from "./couple";
import { loadSignals } from "./taste";

export type DeckResult = { cards: Card[]; total: number };

/**
 * The user's deck, best-first: unseen rings (unless includeSeen), scored against stated prefs and
 * learned taste, with ~30% exploration. Every card goes through buildDeck(), so each has a visual.
 */
export async function getDeckForUser(
  userId: string,
  opts: { includeSeen?: boolean; exclude?: string[] } = {},
): Promise<DeckResult> {
  const [rows, signals, partner] = await Promise.all([
    db.listing.findMany({ where: { active: true }, include: { images: { orderBy: { position: "asc" } }, videos: { orderBy: { position: "asc" } } } }),
    loadSignals(userId),
    getPartnerContext(userId),
  ]);
  // Partner mode: blend in my partner's taste — but only if their swipes are visible to me.
  const partnerSignals = partner?.partnerVisible && partner.partnerId ? await loadSignals(partner.partnerId) : null;
  const seen = opts.includeSeen ? new Set<string>() : new Set(effectiveInteractions(signals.events).map((e) => e.listingId));
  for (const id of opts.exclude ?? []) seen.add(id);

  const cards = buildDeck(rows); // drops anything without a guaranteed visual
  const total = cards.length;
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const ranked = rankDeck(
    cards
      .filter((c) => !seen.has(c.id))
      .map((c) => {
        const r = rowById.get(c.id)!;
        return {
          id: c.id,
          item: c,
          attrs: {
            shape: r.shape, metal: r.metal, setting: r.setting, prongs: r.prongs, centerStone: r.centerStone,
            origin: r.origin, color: r.color, clarity: r.clarity, caratWeight: r.caratWeight, price: r.price,
            bandStyle: r.bandStyle, bandProfile: r.bandProfile,
          },
        };
      }),
    {
      prefs: signals.prefs,
      vector: signals.vector,
      exploreRate: signals.exploreRate,
      seed: `${userId}:${signals.interactionCount}`,
      partner: partnerSignals
        ? { vector: partnerSignals.vector, myWeight: partner!.myWeight, name: partner!.partnerName ?? "your partner" }
        : undefined,
    },
  );
  return { cards: ranked.map((r) => ({ ...r.item, why: r.why, explore: r.explore })), total };
}
