/**
 * Exploration: ~exploreRate of the deck is drawn from outside the user's current taste,
 * so they keep discovering styles (and the taste model keeps learning). Pure + deterministic per seed.
 */

/** Small seeded PRNG (mulberry32). */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `ranked` is best-first. At each slot, with probability exploreRate, take a random item from the
 * lower-scoring part of what's left (an "explore" pick); otherwise take the best remaining item.
 * Every item appears exactly once.
 */
export function mixExploration<T>(ranked: T[], exploreRate: number, seed: string): { item: T; explore: boolean }[] {
  const rand = seededRandom(seed);
  const pool = [...ranked];
  const out: { item: T; explore: boolean }[] = [];
  while (pool.length) {
    const tail = Math.floor(pool.length * 0.6);
    if (pool.length > 2 && tail > 0 && rand() < exploreRate) {
      const start = pool.length - tail;
      const idx = start + Math.floor(rand() * tail);
      out.push({ item: pool.splice(idx, 1)[0]!, explore: true });
    } else {
      out.push({ item: pool.shift()!, explore: false });
    }
  }
  return out;
}
