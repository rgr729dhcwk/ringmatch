"use client";

import {
  closestCorners,
  type CollisionDetection,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { RingSketch } from "@/components/ring3d/RingSketch";
import { formatPrice, type Card } from "@/lib/card";
import { MAX_COMPARE, moveItem, SHORTLIST_TIERS, TIER_IDS, type ShortlistLayout, type TierId } from "@/lib/shortlist";
import { PROCEDURAL_BADGE } from "@/lib/visual";

type Props = { initialLayout: ShortlistLayout; cards: Record<string, Card> };

function findTier(layout: ShortlistLayout, id: string): TierId | null {
  if ((TIER_IDS as string[]).includes(id)) return id as TierId;
  return TIER_IDS.find((t) => layout[t].includes(id)) ?? null;
}

async function persist(layout: ShortlistLayout) {
  const res = await fetch("/api/shortlist", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ layout }),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
}

export function ShortlistBoard({ initialLayout, cards }: Props) {
  const [layout, setLayoutState] = useState(initialLayout);
  const [compare, setCompare] = useState<string[]>([]);
  const [saving, setSaving] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const beforeDrag = useRef<ShortlistLayout | null>(null);
  // The ref always holds the latest layout, so bursts of drag events never read a stale one.
  const layoutRef = useRef(initialLayout);
  const setLayout = (l: ShortlistLayout) => {
    layoutRef.current = l;
    setLayoutState(l);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Rings are the drop targets; a tier box only counts when it holds nothing but the ring being
   * dragged (i.e. it's empty). Otherwise the box would swallow "drop below this ring" — notably
   * with keyboard dragging.
   */
  const collision: CollisionDetection = (args) => {
    const active = String(args.active.id);
    const targets = args.droppableContainers.filter((c) => {
      const id = String(c.id);
      if (!(TIER_IDS as string[]).includes(id)) return true;
      return layoutRef.current[id as TierId].every((x) => x === active);
    });
    return closestCorners({ ...args, droppableContainers: targets });
  };

  const save = (next: ShortlistLayout, revertTo: ShortlistLayout) => {
    setSaving((n) => n + 1);
    persist(next)
      .then(() => setError(null))
      .catch(() => {
        setLayout(revertTo);
        setError("Couldn't save that change. Check your connection and try again.");
      })
      .finally(() => setSaving((n) => n - 1));
  };

  const commit = (next: ShortlistLayout) => {
    const prev = layoutRef.current;
    setLayout(next);
    save(next, prev);
  };

  // While dragging over another tier, move the item into it so the list makes room.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = findTier(layoutRef.current, String(active.id));
    const to = findTier(layoutRef.current, String(over.id));
    if (!from || !to || from === to) return;
    const overIndex = layoutRef.current[to].indexOf(String(over.id));
    setLayout(moveItem(layoutRef.current, String(active.id), to, overIndex < 0 ? undefined : overIndex));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const start = beforeDrag.current ?? layoutRef.current;
    beforeDrag.current = null;
    let next = layoutRef.current;
    if (over) {
      const tier = findTier(next, String(active.id));
      const overTier = findTier(next, String(over.id));
      if (tier && tier === overTier) {
        const a = next[tier].indexOf(String(active.id));
        const b = next[tier].indexOf(String(over.id));
        if (a >= 0 && b >= 0 && a !== b) next = { ...next, [tier]: arrayMove(next[tier], a, b) };
      }
    }
    if (JSON.stringify(next) === JSON.stringify(start)) return setLayout(start);
    setLayout(next);
    save(next, start);
  };

  const remove = async (id: string) => {
    const prev = layoutRef.current;
    setLayout(Object.fromEntries(TIER_IDS.map((t) => [t, prev[t].filter((x) => x !== id)])) as ShortlistLayout);
    setCompare((c) => c.filter((x) => x !== id));
    setSaving((n) => n + 1);
    try {
      const res = await fetch("/api/shortlist/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId: id }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setLayout(prev);
      setError("Couldn't remove that ring. Try again.");
    } finally {
      setSaving((n) => n - 1);
    }
  };

  const toggleCompare = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_COMPARE ? c : [...c, id]));

  const total = useMemo(() => TIER_IDS.reduce((n, t) => n + layout[t].length, 0), [layout]);

  if (total === 0) {
    return (
      <div className="mt-6 rounded-3xl bg-surface p-8 text-center shadow-card" data-testid="shortlist-empty">
        <div className="text-4xl" aria-hidden>
          💍
        </div>
        <h2 className="mt-2 font-serif text-2xl text-ink">Nothing here yet</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Tap <span className="font-semibold">Love it</span> or <span className="font-semibold">Revisit later</span> on a ring and it
          lands here.
        </p>
        <Link href="/" className="mt-4 inline-block rounded-xl bg-accent px-5 py-3 font-semibold text-white">
          Start swiping
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="shortlist" data-saving={saving} className="flex flex-col gap-5 pb-28">
      <p className="text-xs text-ink-soft">
        Drag <span aria-hidden>⠿</span> to reorder or move between tiers (press and hold on a phone), or use the tier menu.
        Tick up to {MAX_COMPARE} rings to compare.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={() => (beforeDrag.current = layoutRef.current)}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          if (beforeDrag.current) setLayout(beforeDrag.current);
          beforeDrag.current = null;
        }}
      >
        {SHORTLIST_TIERS.map((tier) => (
          <TierList key={tier.id} tier={tier.id} label={tier.label} ids={layout[tier.id]}>
            {layout[tier.id].map((id) => (
              <SortableRow
                key={id}
                card={cards[id]!}
                tier={tier.id}
                compared={compare.includes(id)}
                compareFull={compare.length >= MAX_COMPARE}
                onToggleCompare={() => toggleCompare(id)}
                onMove={(t) => commit(moveItem(layoutRef.current, id, t))}
                onRemove={() => remove(id)}
              />
            ))}
          </TierList>
        ))}
      </DndContext>

      {error && (
        <p role="status" className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-canvas/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <span className="flex-1 text-sm text-ink-soft" data-testid="compare-count">
            {compare.length < 2 ? `Tick ${2 - compare.length} more to compare` : `${compare.length} selected`}
          </span>
          {compare.length >= 2 ? (
            <Link
              href={`/shortlist/compare?ids=${compare.join(",")}`}
              className="rounded-xl bg-accent px-5 py-3 font-semibold text-white"
              data-testid="compare-go"
            >
              Compare
            </Link>
          ) : (
            <span className="rounded-xl bg-line px-5 py-3 font-semibold text-ink-soft" aria-disabled>
              Compare
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TierList({ tier, label, ids, children }: { tier: TierId; label: string; ids: string[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: tier });
  return (
    <section aria-label={label} data-testid={`tier-${tier}`}>
      <h2 className="mb-2 flex items-baseline justify-between px-1">
        <span className="font-semibold text-ink">{label}</span>
        <span className="text-xs text-ink-soft">{ids.length}</span>
      </h2>
      <SortableContext id={tier} items={ids} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={`flex min-h-16 flex-col gap-2 rounded-3xl p-1 transition ${isOver ? "bg-accent/10" : ""} ${ids.length === 0 ? "border-2 border-dashed border-line" : ""}`}
        >
          {children}
          {ids.length === 0 && <li className="py-4 text-center text-xs text-ink-soft">Drag a ring here</li>}
        </ul>
      </SortableContext>
    </section>
  );
}

function Thumb({ card }: { card: Card }) {
  if (card.visual.kind === "image") {
    const img = card.visual.images[0];
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img.url} alt="" className="h-full w-full object-cover" draggable={false} data-testid="thumb-image" />;
  }
  return (
    <div className="h-full w-full p-1" data-testid="thumb-sketch">
      <RingSketch params={card.visual.params} />
    </div>
  );
}

function SortableRow(props: {
  card: Card;
  tier: TierId;
  compared: boolean;
  compareFull: boolean;
  onToggleCompare: () => void;
  onMove: (t: TierId) => void;
  onRemove: () => void;
}) {
  const { card, tier, compared, compareFull } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-2xl bg-surface p-2 shadow-card ${isDragging ? "z-10 opacity-80 ring-2 ring-accent" : ""}`}
      data-testid="shortlist-item"
      data-listing-id={card.id}
      data-tier={tier}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${card.title}`}
        className="flex h-16 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-lg text-ink-soft active:cursor-grabbing"
        data-testid="drag-handle"
      >
        ⠿
      </button>
      <div className="visual-backdrop h-16 w-16 shrink-0 overflow-hidden rounded-xl">
        <Thumb card={card} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink" data-testid="shortlist-title">
          {card.title}
        </p>
        <p className="mt-0.5 text-[12px] text-ink-soft">
          {card.price ? formatPrice(card.price) : "Price unknown"} · {card.retailer}
        </p>
        {card.visual.kind === "procedural" && (
          <p className="text-[10px] text-ink-soft" data-testid="procedural-badge">
            {PROCEDURAL_BADGE}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <label className="sr-only" htmlFor={`tier-${card.id}`}>
            Move {card.title} to tier
          </label>
          <select
            id={`tier-${card.id}`}
            value={tier}
            onChange={(e) => props.onMove(e.target.value as TierId)}
            className="rounded-lg border border-line bg-canvas px-1.5 py-1 text-[12px] text-ink"
            data-testid="tier-select"
          >
            {SHORTLIST_TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-[12px] text-ink">
            <input
              type="checkbox"
              checked={compared}
              disabled={!compared && compareFull}
              onChange={props.onToggleCompare}
              className="h-4 w-4 accent-[var(--color-accent)]"
              data-testid="compare-toggle"
            />
            Compare
          </label>
          <button
            type="button"
            onClick={props.onRemove}
            aria-label={`Remove ${card.title} from shortlist`}
            className="ml-auto rounded-lg px-2 py-1 text-[12px] text-ink-soft"
            data-testid="remove"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
