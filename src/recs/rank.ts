/**
 * Ranks the deck: score each ring (stated prefs + learned taste), sort best-first, then mix in
 * ~30% exploration. Ties keep the diverse base order from deckOrder. Pure.
 */
import { blendVectors } from "@/lib/couple";
import type { StatedPrefs } from "@/lib/taxonomy";
import { orderDeck } from "./deckOrder";
import { mixExploration } from "./explore";
import type { RecAttributes } from "./features";
import type { PreferenceVector } from "./preferenceVector";
import { scoreItem } from "./score";
import { whyLine, type Attribution } from "./whyLine";

export type RankInput<T> = { id: string; attrs: RecAttributes; item: T };
export type Ranked<T> = { item: T; score: number; explore: boolean; why: string };

export function rankDeck<T>(
  items: RankInput<T>[],
  ctx: {
    prefs: StatedPrefs;
    vector: PreferenceVector;
    exploreRate: number;
    seed: string;
    /** Partner mode: rank by the blend of both tastes and say whose taste a reason came from. */
    partner?: { vector: PreferenceVector; myWeight: number; name: string };
  },
): Ranked<T>[] {
  const vector = ctx.partner ? blendVectors(ctx.vector, ctx.partner.vector, ctx.partner.myWeight) : ctx.vector;
  const attribution: Attribution | undefined = ctx.partner
    ? { mine: ctx.vector, partner: ctx.partner.vector, partnerName: ctx.partner.name }
    : undefined;
  const base = orderDeck(
    items.map((x) => ({ ...x, shape: x.attrs.shape })),
    ctx.seed,
  );
  const scored = base.map((x, i) => ({ x, i, s: scoreItem(x.attrs, ctx.prefs, vector) }));
  scored.sort((a, b) => b.s.score - a.s.score || a.i - b.i);
  // No signal at all yet → nothing to exploit, so don't label anything as exploration.
  const hasSignal = scored.some((x) => x.s.contributions.length > 0);
  const mixed = hasSignal ? mixExploration(scored, ctx.exploreRate, ctx.seed) : scored.map((item) => ({ item, explore: false }));
  return mixed.map(({ item, explore }) => ({
    item: item.x.item,
    score: item.s.score,
    explore,
    why: whyLine(item.s.contributions, explore, attribution),
  }));
}
