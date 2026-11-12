import type { SwipeAction } from "@/lib/taxonomy";

export type DeckAction = SwipeAction | "undo";

export const ACTION_META: Record<DeckAction, { label: string; key: string; color: string }> = {
  undo: { label: "Undo", key: "Z", color: "var(--color-ink-soft)" },
  dislike: { label: "Nope", key: "←", color: "var(--color-nope)" },
  revisit: { label: "Revisit later", key: "S", color: "var(--color-revisit)" },
  love: { label: "Love it", key: "↑", color: "var(--color-love)" },
  like: { label: "Like", key: "→", color: "var(--color-like)" },
};

/** Where a card flies off to for each action. */
export function exitVector(action: SwipeAction, w: number, h: number): { x: number; y: number; rotate: number } {
  switch (action) {
    case "like":
      return { x: w * 1.3, y: 40, rotate: 22 };
    case "dislike":
      return { x: -w * 1.3, y: 40, rotate: -22 };
    case "love":
      return { x: 0, y: -h * 1.3, rotate: 0 };
    case "revisit":
      return { x: 0, y: h * 1.3, rotate: 0 };
  }
}

/** Keyboard map from the brief: ← dislike, → like, ↑ love, S revisit, Z/Backspace undo. */
export function actionForKey(e: { key: string }): DeckAction | null {
  switch (e.key) {
    case "ArrowLeft":
      return "dislike";
    case "ArrowRight":
      return "like";
    case "ArrowUp":
      return "love";
    case "s":
    case "S":
      return "revisit";
    case "z":
    case "Z":
    case "Backspace":
      return "undo";
    default:
      return null;
  }
}
