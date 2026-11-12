"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Card } from "@/lib/card";
import type { SwipeAction } from "@/lib/taxonomy";
import { ActionBar } from "./ActionBar";
import { actionForKey, type DeckAction } from "./actions";
import { SwipeCard, type SwipeCardHandle } from "./SwipeCard";

type HistoryEntry = { index: number; action: SwipeAction; saved: Promise<string | null> };

async function saveInteraction(listingId: string, action: SwipeAction): Promise<string | null> {
  const res = await fetch("/api/interactions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ listingId, action }),
    keepalive: true,
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
  return ((await res.json()) as { id: string }).id;
}

async function saveUndo(interactionId: string) {
  const res = await fetch("/api/interactions/undo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ interactionId }),
  });
  if (!res.ok) throw new Error(`undo failed: ${res.status}`);
}

export function SwipeDeck({ initialCards, total }: { initialCards: Card[]; total: number }) {
  const [cards] = useState(initialCards);
  const [index, setIndex] = useState(0);
  // History lives in a ref (updated synchronously) so rapid swipes/undos never read stale entries.
  const historyRef = useRef<HistoryEntry[]>([]);
  const [historyLen, setHistoryLen] = useState(0);
  const indexRef = useRef(0);
  const [enter, setEnter] = useState<{ id: string; from: SwipeAction } | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<DeckAction | null>(null);
  const topRef = useRef<SwipeCardHandle>(null);
  const animating = useRef(false);

  const top = cards[index];
  const next = cards[index + 1];

  const track = useCallback(<T,>(p: Promise<T>) => {
    setPending((n) => n + 1);
    return p
      .catch((e: Error) => {
        setError("Couldn't save that swipe. Check your connection.");
        console.error(e);
        return null;
      })
      .finally(() => setPending((n) => n - 1));
  }, []);

  const commit = useCallback(
    (action: SwipeAction) => {
      const i = indexRef.current;
      const card = cards[i];
      if (!card) return;
      const saved = track(saveInteraction(card.id, action));
      historyRef.current = [...historyRef.current, { index: i, action, saved }];
      setHistoryLen(historyRef.current.length);
      indexRef.current = i + 1;
      setEnter(null);
      setLastAction(action);
      setIndex(i + 1);
      animating.current = false;
    },
    [cards, track],
  );

  const undo = useCallback(() => {
    const last = historyRef.current[historyRef.current.length - 1];
    if (!last || animating.current) return;
    historyRef.current = historyRef.current.slice(0, -1);
    setHistoryLen(historyRef.current.length);
    indexRef.current = last.index;
    setIndex(last.index);
    setEnter({ id: cards[last.index]!.id, from: last.action });
    setLastAction("undo");
    void track(
      last.saved.then((id) => {
        if (id) return saveUndo(id);
      }),
    );
  }, [cards, track]);

  const act = useCallback(
    (a: DeckAction) => {
      if (a === "undo") return undo();
      if (!top || animating.current) return;
      animating.current = true;
      void topRef.current?.swipe(a).catch(() => {
        animating.current = false;
      });
    },
    [top, undo],
  );

  // The key listener is attached once and always calls the latest `act`, so a key pressed
  // right after a swipe never sees stale state (e.g. an undo that ignores the newest swipe).
  const actRef = useRef(act);
  useLayoutEffect(() => {
    actRef.current = act;
  }, [act]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const a = actionForKey(e);
      if (!a) return;
      e.preventDefault();
      actRef.current(a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const seenCount = total - cards.length + index;

  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      data-testid="deck"
      data-index={index}
      data-remaining={cards.length - index}
      data-pending={pending}
      data-last-action={lastAction ?? ""}
      aria-label="Ring cards"
    >
      <div className="flex items-center justify-between px-1 pb-2 text-xs text-ink-soft">
        <span data-testid="deck-progress">
          {Math.min(seenCount + (top ? 1 : 0), total)} / {total}
        </span>
        <span className="hidden sm:inline">← nope · → like · ↑ love · S revisit · Z undo</span>
      </div>

      <div className="relative min-h-0 flex-1">
        {top ? (
          <>
            {next && <SwipeCard key={next.id} card={next} isTop={false} onCommit={() => {}} />}
            <SwipeCard
              key={top.id}
              ref={topRef}
              card={top}
              isTop
              enterFrom={enter?.id === top.id ? enter.from : null}
              onCommit={commit}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[28px] bg-surface p-8 text-center shadow-card" data-testid="deck-empty">
            <div className="text-4xl" aria-hidden>✨</div>
            <h2 className="font-serif text-2xl text-ink">You&apos;ve seen every ring</h2>
            <p className="text-sm text-ink-soft">
              More rings and smarter picks arrive in the next update. You can undo your last swipe or go around again.
            </p>
            <Link href="/?all=1" className="rounded-xl bg-accent px-5 py-3 font-semibold text-white" prefetch={false}>
              Start over
            </Link>
          </div>
        )}
      </div>

      {error && (
        <p role="status" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-700" onClick={() => setError(null)}>
          {error}
        </p>
      )}

      <ActionBar onAction={act} canUndo={historyLen > 0} disabled={!top} />
    </section>
  );
}
