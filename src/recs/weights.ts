import type { SwipeAction } from "@/lib/taxonomy";

/** Preference-vector weights per action (Milestone 2). */
export const ACTION_WEIGHTS: Record<SwipeAction, number> = {
  dislike: -1,
  like: 1,
  revisit: 2,
  love: 3,
};

export const DEFAULT_EXPLORE_RATE = 0.3;
/** Half-life, in number of later swipes: a swipe 25 swipes ago counts half as much as the newest. */
export const RECENCY_HALF_LIFE = 25;
