"use client";

import { ACTION_META, type DeckAction } from "./actions";

const ICONS: Record<DeckAction, React.ReactNode> = {
  undo: (
    <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  dislike: <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />,
  strong_dislike: (
    <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
    </g>
  ),
  revisit: <path d="M7 4h10v16l-5-4-5 4z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />,
  love: (
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" fill="currentColor" />
  ),
  like: (
    <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="currentColor" />
  ),
};

const ORDER: DeckAction[] = ["undo", "strong_dislike", "dislike", "revisit", "love", "like"];

export function ActionBar({ onAction, canUndo, disabled }: { onAction: (a: DeckAction) => void; canUndo: boolean; disabled: boolean }) {
  return (
    <div className="flex items-end justify-between gap-1 px-1 pt-3" role="toolbar" aria-label="Swipe actions">
      {ORDER.map((a) => {
        const meta = ACTION_META[a];
        const big = a === "dislike" || a === "like";
        const isDisabled = a === "undo" ? !canUndo : disabled;
        return (
          <button
            key={a}
            type="button"
            data-testid={`action-${a}`}
            aria-label={`${a === "strong_dislike" ? "Strongly dislike" : meta.label} (${meta.key === "Z" ? "Z or Backspace" : meta.key})`}
            aria-keyshortcuts={a === "undo" ? "Z Backspace" : undefined}
            disabled={isDisabled}
            onClick={() => onAction(a)}
            className="group flex flex-1 flex-col items-center gap-1 disabled:opacity-35"
          >
            <span
              className={`grid place-items-center rounded-full bg-surface shadow-card transition active:scale-90 ${big ? "h-[60px] w-[60px]" : "h-11 w-11"}`}
              style={{ color: meta.color }}
            >
              <svg viewBox="0 0 24 24" className={big ? "h-8 w-8" : "h-6 w-6"} aria-hidden>
                {ICONS[a]}
              </svg>
            </span>
            <span className="text-[11px] font-medium leading-tight text-ink-soft">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
