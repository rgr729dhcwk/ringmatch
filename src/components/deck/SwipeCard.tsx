"use client";

import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { formatPrice, type Card } from "@/lib/card";
import type { SwipeAction } from "@/lib/taxonomy";
import { exitVector } from "./actions";
import { CardVisual } from "./CardVisual";

/** "Tap for photos, video & 3D" — lists what the detail view offers. */
function tapHint(card: Card): string {
  const parts: string[] = [];
  if (card.visual.kind === "image" && card.visual.images.length > 1) parts.push("photos");
  if (card.videos.length) parts.push("video");
  if (card.visual.kind === "procedural" || card.preview3d) parts.push("3D");
  if (!parts.length) return "Tap for details";
  return `Tap for ${parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} & ${parts[parts.length - 1]}`}`;
}

export type SwipeCardHandle = { swipe: (a: SwipeAction) => Promise<void> };

type Props = {
  card: Card;
  isTop: boolean;
  /** When re-entering after an undo, the direction it originally left in. */
  enterFrom?: SwipeAction | null;
  onCommit: (a: SwipeAction) => void;
  /** Tap (no drag) → open the detail view. */
  onOpen?: () => void;
  /** Detail view is open: release the live 3D canvas (one WebGL context at a time). */
  paused?: boolean;
};

const SWIPE_X = 110;
const SWIPE_UP = 120;

export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard({ card, isTop, enterFrom, onCommit, onOpen, paused }, ref) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rot = useMotionValue(0);
  const dragRotate = useTransform(x, [-220, 220], [-14, 14]);
  const rotate = useTransform(() => rot.get() + dragRotate.get());
  const likeOpacity = useTransform(x, [30, SWIPE_X], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_X, -30], [1, 0]);
  const loveOpacity = useTransform(y, [-SWIPE_UP, -40], [1, 0]);
  const busy = useRef(false);

  const size = () => ({ w: typeof window === "undefined" ? 400 : window.innerWidth, h: typeof window === "undefined" ? 800 : window.innerHeight });

  useEffect(() => {
    if (!enterFrom) return;
    const v = exitVector(enterFrom, size().w, size().h);
    x.set(v.x);
    y.set(v.y);
    rot.set(v.rotate);
    const o = { type: "spring", stiffness: 260, damping: 28 } as const;
    animate(x, 0, o);
    animate(y, 0, o);
    animate(rot, 0, o);
  }, [enterFrom, x, y, rot]);

  const flyOut = async (a: SwipeAction) => {
    if (busy.current) return;
    busy.current = true;
    const v = exitVector(a, size().w, size().h);
    const o = { duration: 0.28, ease: "easeIn" } as const;
    await Promise.all([animate(x, v.x, o), animate(y, v.y, o), animate(rot, v.rotate, o)]);
    onCommit(a);
  };

  useImperativeHandle(ref, () => ({ swipe: flyOut }));

  // Our own tap detection: a tap is a press that barely moves (< 8px) and lifts quickly.
  // (The animation library's onTap also fired after short drags.)
  const press = useRef<{ x: number; y: number; t: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    press.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p || busy.current) return;
    const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
    if (moved < 8 && performance.now() - p.t < 500 && Math.abs(x.get()) < 8 && Math.abs(y.get()) < 8) {
      if ((e.target as HTMLElement).closest("a,button")) return; // links/buttons on the card do their own thing
      onOpen?.();
    }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.y < -SWIPE_UP && Math.abs(offset.y) > Math.abs(offset.x)) return void flyOut("love");
    if (velocity.y < -800 && Math.abs(offset.x) < 60) return void flyOut("love");
    if (offset.x > SWIPE_X || velocity.x > 700) return void flyOut("like");
    if (offset.x < -SWIPE_X || velocity.x < -700) return void flyOut("dislike");
    const o = { type: "spring", stiffness: 400, damping: 30 } as const;
    animate(x, 0, o);
    animate(y, 0, o);
  };

  return (
    <motion.article
      className="absolute inset-0 flex select-none flex-col overflow-hidden rounded-[28px] bg-surface shadow-card"
      // The peeking card is nudged down via its own wrapper offset (not motion's `y`), so when it
      // becomes the top card it sits exactly in place and drag/fly-out start from zero.
      style={isTop ? { x, y, rotate, touchAction: "none" } : { top: 12 }}
      initial={false}
      animate={isTop ? { scale: 1, opacity: 1 } : { scale: 0.95, opacity: 1 }}
      drag={isTop}
      onPointerDown={isTop ? onPointerDown : undefined}
      onPointerUp={isTop ? onPointerUp : undefined}
      dragMomentum={false}
      onDragEnd={isTop ? onDragEnd : undefined}
      data-testid={isTop ? "top-card" : "next-card"}
      data-card-id={card.id}
      aria-hidden={!isTop}
      aria-label={isTop ? card.title : undefined}
    >
      <div className="relative min-h-0 flex-1">
        <CardVisual visual={card.visual} title={card.title} live={isTop && !paused} hasVideo={card.videos.length > 0} />
        {isTop && (
          <span
            className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white"
            data-testid="tap-hint"
          >
            {tapHint(card)}
          </span>
        )}
        {isTop && (
          <>
            <Stamp text="LIKE" color="var(--color-like)" style={{ opacity: likeOpacity }} className="left-4 -rotate-12" />
            <Stamp text="NOPE" color="var(--color-nope)" style={{ opacity: nopeOpacity }} className="right-4 rotate-12" />
            <Stamp text="LOVE IT" color="var(--color-love)" style={{ opacity: loveOpacity }} className="left-1/2 -translate-x-1/2" />
          </>
        )}
      </div>
      <CardDetails card={card} />
    </motion.article>
  );
});

function Stamp({ text, color, className, style }: { text: string; color: string; className: string; style: { opacity: unknown } }) {
  return (
    <motion.span
      aria-hidden
      className={`pointer-events-none absolute top-14 rounded-lg border-4 px-3 py-1 text-2xl font-black tracking-widest ${className}`}
      style={{ color, borderColor: color, ...(style as object) }}
    >
      {text}
    </motion.span>
  );
}

function CardDetails({ card }: { card: Card }) {
  return (
    <div className="shrink-0 border-t border-line px-4 pb-4 pt-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink" data-testid="card-title">
          {card.title}
        </h2>
        {card.price && (
          <span className="shrink-0 text-[15px] font-semibold text-ink" data-testid="card-price">
            {formatPrice(card.price)}
          </span>
        )}
      </div>
      {card.why && (
        <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-accent" data-testid="card-why" data-explore={card.explore ? "1" : "0"}>
          <span aria-hidden>{card.explore ? "🧭" : "✨"}</span>
          {card.why}
        </p>
      )}
      <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-[12px]">
        {card.specs.slice(0, 9).map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="text-ink-soft">{s.label}</dt>
            <dd className="truncate font-medium text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-center justify-between text-[12px] text-ink-soft">
        <span data-testid="card-retailer">{card.retailer}</span>
        {card.sourceUrl ? (
          <a
            href={card.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-accent underline-offset-2 hover:underline"
            onPointerDown={(e) => e.stopPropagation()}
          >
            View listing ↗
          </a>
        ) : (
          <span className="rounded-full bg-canvas px-2 py-0.5 font-medium" data-testid="sample-label">
            Sample card
          </span>
        )}
      </div>
    </div>
  );
}
