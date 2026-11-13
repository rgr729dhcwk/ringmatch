/**
 * Shortlist rules (pure — no DB or React).
 * The shortlist = rings whose latest effective swipe is "love" or "revisit".
 * Order and tier live in ShortlistOrder rows, created lazily with sensible defaults.
 */
import type { SwipeAction } from "./taxonomy";

export const SHORTLIST_TIERS = [
  { id: "top", label: "Top picks" },
  { id: "strong", label: "Strong contenders" },
  { id: "maybe", label: "Maybe" },
] as const;
export type TierId = (typeof SHORTLIST_TIERS)[number]["id"];
export const TIER_IDS = SHORTLIST_TIERS.map((t) => t.id) as [TierId, ...TierId[]];
export const isTier = (t: string): t is TierId => (TIER_IDS as string[]).includes(t);

export const SHORTLIST_ACTIONS: readonly SwipeAction[] = ["love", "revisit"];
export const MAX_COMPARE = 3;

export function defaultTierFor(action: SwipeAction): TierId {
  return action === "love" ? "top" : "maybe";
}

export type SavedSwipe = { listingId: string; action: SwipeAction; createdAt: Date };
export type OrderRow = { listingId: string; tier: string; rank: number; removedAt: Date | null };
export type ShortlistEntry = { listingId: string; tier: TierId; rank: number; action: SwipeAction; isNew: boolean };

/**
 * Combine effective swipes with stored order rows.
 * - Latest swipe per listing wins; only love/revisit make the list.
 * - A removed row stays hidden unless the ring was loved/saved again after removal.
 * - Rings without a row get their default tier and go to the end of it (isNew = true → persist).
 */
export function computeShortlist(swipes: SavedSwipe[], rows: OrderRow[]): Record<TierId, ShortlistEntry[]> {
  const latest = new Map<string, SavedSwipe>();
  for (const s of swipes) {
    const prev = latest.get(s.listingId);
    if (!prev || s.createdAt.getTime() >= prev.createdAt.getTime()) latest.set(s.listingId, s);
  }
  const rowBy = new Map(rows.map((r) => [r.listingId, r]));
  const out = Object.fromEntries(TIER_IDS.map((t) => [t, [] as ShortlistEntry[]])) as Record<TierId, ShortlistEntry[]>;
  const fresh: ShortlistEntry[] = [];

  for (const s of latest.values()) {
    if (!SHORTLIST_ACTIONS.includes(s.action)) continue;
    const row = rowBy.get(s.listingId);
    if (row?.removedAt && s.createdAt.getTime() <= row.removedAt.getTime()) continue;
    if (row && !row.removedAt && isTier(row.tier)) {
      out[row.tier].push({ listingId: s.listingId, tier: row.tier, rank: row.rank, action: s.action, isNew: false });
    } else {
      fresh.push({ listingId: s.listingId, tier: defaultTierFor(s.action), rank: 0, action: s.action, isNew: true });
    }
  }
  for (const t of TIER_IDS) out[t].sort((a, b) => a.rank - b.rank || a.listingId.localeCompare(b.listingId));
  // New arrivals go to the end of their tier, oldest swipe first.
  fresh.sort((a, b) => latest.get(a.listingId)!.createdAt.getTime() - latest.get(b.listingId)!.createdAt.getTime());
  for (const f of fresh) out[f.tier].push(f);
  // Re-number ranks 0..n per tier so they're contiguous.
  for (const t of TIER_IDS) out[t] = out[t].map((e, i) => ({ ...e, rank: i }));
  return out;
}

/** A new layout from the client: tier → ordered listing ids. */
export type ShortlistLayout = Record<TierId, string[]>;

/** Accept a layout only if it's exactly a rearrangement of the current shortlist. */
export function validateLayout(layout: unknown, current: Record<TierId, ShortlistEntry[]>): ShortlistLayout | null {
  if (!layout || typeof layout !== "object") return null;
  const l = layout as Record<string, unknown>;
  const ids: string[] = [];
  const out = {} as ShortlistLayout;
  for (const t of TIER_IDS) {
    const v = l[t] ?? [];
    if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) return null;
    out[t] = v as string[];
    ids.push(...(v as string[]));
  }
  if (Object.keys(l).some((k) => !isTier(k))) return null;
  const expected = TIER_IDS.flatMap((t) => current[t].map((e) => e.listingId));
  if (ids.length !== expected.length || new Set(ids).size !== ids.length) return null;
  const want = new Set(expected);
  return ids.every((id) => want.has(id)) ? out : null;
}

/** Move one item to a tier/position (used by the "Move to…" menu and keyboard). */
export function moveItem(layout: ShortlistLayout, id: string, toTier: TierId, toIndex?: number): ShortlistLayout {
  const next = Object.fromEntries(TIER_IDS.map((t) => [t, layout[t].filter((x) => x !== id)])) as ShortlistLayout;
  const list = next[toTier];
  const i = toIndex == null ? list.length : Math.max(0, Math.min(toIndex, list.length));
  list.splice(i, 0, id);
  return next;
}
