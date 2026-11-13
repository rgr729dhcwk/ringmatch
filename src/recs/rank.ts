/**
 * Ranks the deck: score each ring (stated prefs + learned taste), sort best-first, then mix in
 * ~30% exploration. Ties keep the diverse base order from deckOrder. Pure.
 */
import type { StatedPrefs } from "@/lib/taxonomy";
import { orderDeck } from "./deckOrder";
import { mixExploration } from "./explore";
import type { RecAttributes } from "./features";
import type { PreferenceVector } from "./preferenceVector";
import { scoreItem } from "./score";
import { whyLine } from "./whyLine";

export type RankInput<T> = { id: string; attrs: RecAttributes; item: T };
export type Ranked<T> = { item: T; score: number; explore: boolean; why: string };

export function rankDeck<T>(
  items: RankInput<T>[],
  ctx: { prefs: StatedPrefs; vector: PreferenceVector; exploreRate: number; seed: string },
): Ranked<T>[] {
  const base = orderDeck(
    items.map((x) => ({ ...x, shape: x.attrs.shape })),
    ctx.seed,
  );
  const scored = base.map((x, i) => ({ x, i, s: scoreItem(x.attrs, ctx.prefs, ctx.vector) }));
  scored.sort((a, b) => b.s.score - a.s.score || a.i - b.i);
  // No signal at all yet → nothing to exploit, so don't label anything as exploration.
  const hasSignal = scored.some((x) => x.s.contributions.length > 0);
  const mixed = hasSignal ? mixExploration(scored, ctx.exploreRate, ctx.seed) : scored.map((item) => ({ item, explore: false }));
  return mixed.map(({ item, explore }) => ({
    item: item.x.item,
    score: item.s.score,
    explore,
    why: whyLine(item.s.contributions, explore),
  }));
}
