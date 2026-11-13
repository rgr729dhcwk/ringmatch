/**
 * Builds a taste vector from swipes. Each feature of a swiped ring accumulates
 * ACTION_WEIGHTS[action] × recency decay. Undo rows cancel the row they point at.
 * Pure — no DB or React.
 */
import type { InteractionAction, SwipeAction } from "@/lib/taxonomy";
import { featuresOf, type Feature, type RecAttributes } from "./features";
import { ACTION_WEIGHTS, RECENCY_HALF_LIFE } from "./weights";

export type InteractionEvent = {
  id: string;
  action: InteractionAction;
  undoesId: string | null;
  createdAt: Date;
  attributes: RecAttributes;
};

export type PreferenceVector = Record<string, number>;

/** Returns the interactions still in effect (undone rows and undo rows removed). */
export function effectiveInteractions<T extends { id: string; action: string; undoesId: string | null }>(events: T[]): T[] {
  const undone = new Set(events.filter((e) => e.action === "undo" && e.undoesId).map((e) => e.undoesId!));
  return events.filter((e) => e.action !== "undo" && !undone.has(e.id));
}

/**
 * Recency decay: the newest swipe counts fully; one made `age` swipes ago counts 0.5^(age/halfLife).
 * (Counted in swipes rather than days, so taste follows what you've seen recently.)
 */
export function recencyDecay(age: number, halfLife = RECENCY_HALF_LIFE): number {
  return Math.pow(0.5, age / halfLife);
}

export function computePreferenceVector(events: InteractionEvent[], halfLife = RECENCY_HALF_LIFE): PreferenceVector {
  const eff = effectiveInteractions(events).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const v: PreferenceVector = {};
  eff.forEach((e, i) => {
    const age = eff.length - 1 - i;
    const w = ACTION_WEIGHTS[e.action as SwipeAction] * recencyDecay(age, halfLife);
    for (const f of featuresOf(e.attributes)) v[f] = (v[f] ?? 0) + w;
  });
  return v;
}

export function topFeatures(v: PreferenceVector, n: number, sign: 1 | -1 = 1): [Feature, number][] {
  return (Object.entries(v) as [Feature, number][])
    .filter(([, x]) => x * sign > 0)
    .sort((a, b) => (b[1] - a[1]) * sign)
    .slice(0, n);
}
