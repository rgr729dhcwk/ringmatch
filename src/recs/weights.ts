import type { SwipeAction } from "@/lib/taxonomy";

/**
 * How much each swipe counts toward taste (revised after Milestone 4 with the user):
 * hard no −2, nope −1, like +1, revisit later +1.25 (a bit more than a like), love +2 (about double).
 * Expect to tune these.
 */
export const ACTION_WEIGHTS: Record<SwipeAction, number> = {
  strong_dislike: -2,
  dislike: -1,
  like: 1,
  revisit: 1.25,
  love: 2,
};

export const DEFAULT_EXPLORE_RATE = 0.3;
/** Half-life, in number of later swipes: a swipe 25 swipes ago counts half as much as the newest. */
export const RECENCY_HALF_LIFE = 25;
