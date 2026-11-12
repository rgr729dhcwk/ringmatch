/**
 * Milestone 1 deck order: a stable per-user shuffle, then spread out so the same shape
 * doesn't appear twice in a row when avoidable. Pure — no DB or React imports.
 * Milestone 2 replaces this with scoring (preferenceVector.ts) + exploration.
 */
export type Orderable = { id: string; shape?: string | null };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function orderDeck<T extends Orderable>(items: T[], seed: string): T[] {
  const shuffled = [...items].sort((a, b) => hash(seed + a.id) - hash(seed + b.id) || a.id.localeCompare(b.id));
  const out: T[] = [];
  const pool = [...shuffled];
  while (pool.length) {
    const last = out[out.length - 1]?.shape;
    const idx = pool.findIndex((x) => !x.shape || x.shape !== last);
    out.push(pool.splice(idx === -1 ? 0 : idx, 1)[0]!);
  }
  return out;
}
