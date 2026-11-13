import type { SwipeAction } from "@/lib/taxonomy";

export type DeckAction = SwipeAction | "undo";

export const ACTION_META: Record<DeckAction, { label: string; key: string; color: string }> = {
  undo: { label: "Undo", key: "Z", color: "var(--color-ink-soft)" },
  strong_dislike: { label: "Hard no", key: "↓", color: "#8f1d17" },
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
    case "strong_dislike":
      return { x: -w * 1.3, y: h * 0.4, rotate: -40 };
    case "love":
      return { x: 0, y: -h * 1.3, rotate: 0 };
    case "revisit":
      return { x: 0, y: h * 1.3, rotate: 0 };
  }
}

/** Keys: ← nope, ↓ hard no, → like, ↑ love, S revisit, Z/Backspace undo, Enter/I details. */
export function actionForKey(e: { key: string }): DeckAction | null {
  switch (e.key) {
    case "ArrowLeft":
      return "dislike";
    case "ArrowRight":
      return "like";
    case "ArrowUp":
      return "love";
    case "ArrowDown":
      return "strong_dislike";
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
