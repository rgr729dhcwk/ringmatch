import type { SwipeAction } from "@/lib/taxonomy";

/** Preference-vector weights per action (Milestone 2). */
export const ACTION_WEIGHTS: Record<SwipeAction, number> = {
  dislike: -1,
  like: 1,
  revisit: 2,
  love: 3,
};

export const DEFAULT_EXPLORE_RATE = 0.3;
/** Half-life (in number of later interactions) for recency decay. Tuned in Milestone 2. */
export const RECENCY_HALF_LIFE = 50;
