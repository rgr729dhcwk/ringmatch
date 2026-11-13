"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Card } from "@/lib/card";
import type { SwipeAction } from "@/lib/taxonomy";
import { ActionBar } from "./ActionBar";
import { actionForKey, type DeckAction } from "./actions";
import { CardDetail } from "./CardDetail";
import { SHORTLIST_DELTA_EVENT } from "./ShortlistCount";
import { SwipeCard, type SwipeCardHandle } from "./SwipeCard";

type HistoryEntry = { card: Card; action: SwipeAction; saved: Promise<string | null> };

const savesToShortlist = (a: SwipeAction) => a === "love" || a === "revisit";
const announceShortlist = (delta: number) => window.dispatchEvent(new CustomEvent(SHORTLIST_DELTA_EVENT, { detail: delta }));

/** Re-rank the upcoming cards after this many swipes (or sooner when the queue runs low). */
const REFRESH_EVERY = 3;

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

export function SwipeDeck({ initialCards, total, includeSeen }: { initialCards: Card[]; total: number; includeSeen: boolean }) {
  // queue[0] is the top card. Kept in a ref too so rapid input never reads stale state.
  const [queue, setQueueState] = useState(initialCards);
  const queueRef = useRef(initialCards);
  const setQueue = (q: Card[]) => {
    queueRef.current = q;
    setQueueState(q);
  };
  const historyRef = useRef<HistoryEntry[]>([]);
  const [historyLen, setHistoryLen] = useState(0);
  const [enter, setEnter] = useState<{ id: string; from: SwipeAction } | null>(null);
  const [pending, setPending] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<DeckAction | null>(null);
  // The card shown in the detail view (tap a card to open it).
  const [detail, setDetail] = useState<Card | null>(null);
  const detailRef = useRef<Card | null>(null);
  const openDetail = (c: Card | null) => {
    detailRef.current = c;
    setDetail(c);
  };
  const topRef = useRef<SwipeCardHandle>(null);
  const animating = useRef(false);
  const sinceRefresh = useRef(0);
  const refreshSeq = useRef(0);

  const top = queue[0];
  const next = queue[1];

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

  /** Ask the server to re-rank what's left, now that it knows about the latest swipes. */
  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current;
    sinceRefresh.current = 0;
    setRefreshing(true);
    try {
      await Promise.allSettled(historyRef.current.map((h) => h.saved));
      const swiped = historyRef.current.map((h) => h.card.id);
      const keepNow = queueRef.current.slice(0, 2).map((c) => c.id);
      const qs = new URLSearchParams({ exclude: [...swiped, ...keepNow].join(",") });
      if (includeSeen) qs.set("all", "1");
      const res = await fetch(`/api/deck?${qs}`);
      if (!res.ok) throw new Error(`deck refresh failed: ${res.status}`);
      const data = (await res.json()) as { cards: Card[] };
      if (seq !== refreshSeq.current) return; // a newer refresh superseded this one
      // Keep the two cards already on screen; replace everything after them with the new ranking.
      const kept = queueRef.current.slice(0, 2);
      const block = new Set([...kept.map((c) => c.id), ...historyRef.current.map((h) => h.card.id)]);
      setQueue([...kept, ...data.cards.filter((c) => !block.has(c.id))]);
    } catch (e) {
      console.error(e); // keep the current order; swiping still works
    } finally {
      if (seq === refreshSeq.current) setRefreshing(false);
    }
  }, [includeSeen]);

  const commit = useCallback(
    (action: SwipeAction) => {
      const card = queueRef.current[0];
      if (!card) return;
      const saved = track(saveInteraction(card.id, action));
      historyRef.current = [...historyRef.current, { card, action, saved }];
      setHistoryLen(historyRef.current.length);
      setQueue(queueRef.current.slice(1));
      setEnter(null);
      setLastAction(action);
      if (savesToShortlist(action)) announceShortlist(1);
      animating.current = false;
      sinceRefresh.current++;
      if (sinceRefresh.current >= REFRESH_EVERY && queueRef.current.length > 2) void refresh();
    },
    [track, refresh],
  );

  const undo = useCallback(() => {
    const last = historyRef.current[historyRef.current.length - 1];
    if (!last || animating.current) return;
    historyRef.current = historyRef.current.slice(0, -1);
    setHistoryLen(historyRef.current.length);
    setQueue([last.card, ...queueRef.current.filter((c) => c.id !== last.card.id)]);
    setEnter({ id: last.card.id, from: last.action });
    setLastAction("undo");
    if (savesToShortlist(last.action)) announceShortlist(-1);
    void track(
      last.saved.then((id) => {
        if (id) return saveUndo(id);
      }),
    );
  }, [track]);

  const act = useCallback(
    (a: DeckAction) => {
      if (a === "undo") return undo();
      if (!queueRef.current[0] || animating.current) return;
      animating.current = true;
      void topRef.current?.swipe(a).catch(() => {
        animating.current = false;
      });
    },
    [undo],
  );

  // The key listener is attached once and always calls the latest `act`.
  const actRef = useRef(act);
  useLayoutEffect(() => {
    actRef.current = act;
  }, [act]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (detailRef.current) return; // the detail view handles its own keys
      if ((e.key === "Enter" || e.key === "i" || e.key === "I") && queueRef.current[0]) {
        if (t && (t.tagName === "BUTTON" || t.tagName === "A")) return; // let focused buttons/links work
        e.preventDefault();
        openDetail(queueRef.current[0]);
        return;
      }
      const a = actionForKey(e);
      if (!a) return;
      e.preventDefault();
      actRef.current(a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const position = Math.min(total - queue.length + 1, total);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      data-testid="deck"
      data-index={historyLen}
      data-remaining={queue.length}
      data-pending={pending}
      data-refreshing={refreshing ? "1" : "0"}
      data-last-action={lastAction ?? ""}
      aria-label="Ring cards"
    >
      <div className="flex items-center justify-between px-1 pb-2 text-xs text-ink-soft">
        <span data-testid="deck-progress">
          {top ? position : total} / {total}
        </span>
        <span className="hidden sm:inline">← nope · ↓ hard no · → like · ↑ love · S revisit · Z undo · Enter details</span>
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
              onOpen={() => openDetail(top)}
              paused={detail !== null}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[28px] bg-surface p-8 text-center shadow-card" data-testid="deck-empty">
            <div className="text-4xl" aria-hidden>✨</div>
            <h2 className="font-serif text-2xl text-ink">You&apos;ve seen every ring</h2>
            <p className="text-sm text-ink-soft">Have a look at what your swipes say about your taste, or go around again.</p>
            <Link href="/taste" className="rounded-xl bg-accent px-5 py-3 font-semibold text-white">
              See my taste
            </Link>
            <Link href="/?all=1" className="text-sm font-semibold text-accent" prefetch={false}>
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

      {detail && (
        <CardDetail
          card={detail}
          onClose={() => openDetail(null)}
          onAction={(a) => {
            openDetail(null);
            // Let the card come back into view, then send it off in the chosen direction.
            requestAnimationFrame(() => act(a));
          }}
        />
      )}
    </section>
  );
}
