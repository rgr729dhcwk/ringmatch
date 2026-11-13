"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { RingSketch } from "@/components/ring3d/RingSketch";
import { formatPrice, type Card } from "@/lib/card";
import type { SwipeAction } from "@/lib/taxonomy";
import { PROCEDURAL_BADGE, type ProceduralParams } from "@/lib/visual";
import { ACTION_META } from "./actions";

const ProceduralRing = dynamic(() => import("@/components/ring3d/ProceduralRing"), { ssr: false, loading: () => null });

type Tab = "photos" | "3d";

/**
 * Tap a card → this detail view: browse every photo, spin/zoom the 3D ring, read all the details,
 * and follow the link to the shop. While it's open the deck card behind it releases its WebGL canvas,
 * so there is still only one live 3D view on the page.
 */
export function CardDetail({ card, onClose, onAction }: { card: Card; onClose: () => void; onAction: (a: SwipeAction) => void }) {
  const photos = card.visual.kind === "image" ? card.visual.images : [];
  const params: ProceduralParams | null = card.visual.kind === "procedural" ? card.visual.params : (card.preview3d ?? null);
  const [tab, setTab] = useState<Tab>(photos.length ? "photos" : "3d");
  const [photo, setPhoto] = useState(0);
  const [rendered, setRendered] = useState<false | "webgl" | "svg">(false);
  const strip = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  const goTo = useCallback(
    (i: number) => {
      const n = Math.max(0, Math.min(photos.length - 1, i));
      strip.current?.scrollTo({ left: n * strip.current.clientWidth, behavior: "smooth" });
      setPhoto(n);
    },
    [photos.length],
  );

  useEffect(() => {
    closeBtn.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (tab === "photos" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        goTo(photo + (e.key === "ArrowRight" ? 1 : -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, tab, photo, goTo]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Details: ${card.title}`}
      className="fixed inset-0 z-50 flex flex-col bg-canvas"
      data-testid="card-detail"
      data-card-id={card.id}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-[max(env(safe-area-inset-top),10px)]">
        <button
          ref={closeBtn}
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-xl text-ink shadow-card"
          aria-label="Close details (Esc)"
          data-testid="detail-close"
        >
          ×
        </button>
        <h2 className="line-clamp-2 flex-1 text-[15px] font-semibold leading-snug text-ink">{card.title}</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-28">
        {photos.length > 0 && params && (
          <div className="mx-3 mb-2 flex rounded-full bg-surface p-1 text-sm font-semibold shadow-card" role="tablist">
            {(["photos", "3d"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-full py-1.5 ${tab === t ? "bg-accent text-white" : "text-ink-soft"}`}
                data-testid={`detail-tab-${t}`}
              >
                {t === "photos" ? `Photos (${photos.length})` : "3D view"}
              </button>
            ))}
          </div>
        )}

        <div className="visual-backdrop relative mx-3 aspect-square max-h-[60dvh] overflow-hidden rounded-[24px]">
          {tab === "photos" && photos.length > 0 ? (
            <>
              <div
                ref={strip}
                className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  setPhoto(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
                }}
                data-testid="detail-gallery"
              >
                {photos.map((im, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={im.url}
                    src={im.url}
                    alt={`${card.title} — photo ${i + 1} of ${photos.length}`}
                    loading={i < 2 ? "eager" : "lazy"}
                    className="h-full w-full shrink-0 snap-center bg-white object-contain"
                    draggable={false}
                    data-testid="detail-photo"
                  />
                ))}
              </div>
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => goTo(photo - 1)}
                    disabled={photo === 0}
                    aria-label="Previous photo"
                    className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-lg shadow disabled:opacity-0"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(photo + 1)}
                    disabled={photo === photos.length - 1}
                    aria-label="Next photo"
                    className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-lg shadow disabled:opacity-0"
                    data-testid="detail-next-photo"
                  >
                    ›
                  </button>
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white" data-testid="detail-photo-index">
                    {photo + 1} / {photos.length}
                  </span>
                </>
              )}
            </>
          ) : params ? (
            <div className="relative h-full w-full" data-testid="detail-3d" data-rendered={rendered ? "true" : "false"} data-render-mode={rendered || undefined}>
              {rendered !== "webgl" && rendered !== "svg" && (
                <div className="absolute inset-0 p-6" aria-hidden>
                  <RingSketch params={params} />
                </div>
              )}
              <div className="absolute inset-0">
                <ProceduralRing params={params} interactive onReady={(m) => setRendered(m)} />
              </div>
              <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-sm" data-testid="procedural-badge">
                {PROCEDURAL_BADGE}
              </span>
              <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] text-white">
                Drag to spin · pinch to zoom
              </span>
            </div>
          ) : null}
        </div>

        <section className="mx-3 mt-3 rounded-3xl bg-surface p-4 shadow-card">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xl font-semibold text-ink" data-testid="detail-price">
              {card.price ? formatPrice(card.price) : "Price on request"}
            </span>
            <span className="text-sm text-ink-soft">{card.retailer}</span>
          </div>
          {card.why && <p className="mt-1 text-[13px] font-medium text-accent">{card.why}</p>}
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]" data-testid="detail-specs">
            {card.specs.map((s) => (
              <div key={s.label} className="min-w-0">
                <dt className="text-ink-soft">{s.label}</dt>
                <dd className="font-medium text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
          {card.sourceUrl ? (
            <a
              href={card.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block rounded-xl bg-accent px-4 py-3 text-center font-semibold text-white"
              data-testid="detail-shop-link"
            >
              View at {card.retailer} ↗
            </a>
          ) : (
            <p className="mt-4 rounded-xl bg-canvas px-4 py-3 text-center text-sm text-ink-soft">Sample card — not a real listing</p>
          )}
          <p className="mt-2 text-[11px] leading-snug text-ink-soft">{card.attribution}</p>
        </section>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 flex justify-center gap-2 border-t border-line bg-canvas/95 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur"
        aria-label="Decide on this ring"
      >
        {(["strong_dislike", "dislike", "revisit", "love", "like"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onAction(a)}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-surface py-2 text-[11px] font-semibold shadow-card"
            style={{ color: ACTION_META[a].color }}
            data-testid={`detail-action-${a}`}
          >
            {ACTION_META[a].label}
          </button>
        ))}
      </nav>
    </div>
  );
}
