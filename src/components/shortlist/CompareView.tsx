"use client";

import { useState } from "react";
import { CardVisual } from "@/components/deck/CardVisual";
import { formatPrice, type Card } from "@/lib/card";

/**
 * Side-by-side comparison. Only one column at a time may run the live 3D render
 * (browsers limit WebGL contexts); the others show the sketch until tapped.
 */
export function CompareView({ cards }: { cards: Card[] }) {
  const [live, setLive] = useState<string | null>(null);
  const labels: string[] = ["Price"];
  for (const c of cards) for (const s of c.specs) if (!labels.includes(s.label)) labels.push(s.label);
  const valueOf = (c: Card, label: string) =>
    label === "Price" ? (c.price ? formatPrice(c.price) : "—") : (c.specs.find((s) => s.label === label)?.value ?? "—");

  const cols = `minmax(84px, 0.8fr) repeat(${cards.length}, minmax(0, 1fr))`;
  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-card" data-testid="compare" data-columns={cards.length}>
      <div className="grid gap-x-2 border-b border-line p-2" style={{ gridTemplateColumns: cols }}>
        <div />
        {cards.map((c) => (
          <div key={c.id} className="min-w-0" data-testid="compare-column" data-listing-id={c.id}>
            <div className="aspect-square overflow-hidden rounded-2xl">
              <CardVisual visual={c.visual} title={c.title} live={live === c.id} />
            </div>
            {c.visual.kind === "procedural" && (
              <button
                type="button"
                onClick={() => setLive(live === c.id ? null : c.id)}
                className="mt-1 w-full rounded-lg bg-canvas py-1 text-[11px] font-semibold text-accent"
                data-testid="compare-3d"
              >
                {live === c.id ? "Stop 3D" : "View in 3D"}
              </button>
            )}
            <p className="mt-1 line-clamp-3 text-[12px] font-semibold leading-snug text-ink">{c.title}</p>
            {c.sourceUrl ? (
              <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-accent">
                View at {c.retailer} ↗
              </a>
            ) : (
              <p className="text-[11px] text-ink-soft">{c.retailer} · Sample card</p>
            )}
          </div>
        ))}
      </div>
      <dl>
        {labels.map((label) => {
          const values = cards.map((c) => valueOf(c, label));
          const differs = new Set(values).size > 1;
          return (
            <div
              key={label}
              className={`grid gap-x-2 px-2 py-2 text-[12px] odd:bg-canvas/60 ${differs ? "" : "text-ink-soft"}`}
              style={{ gridTemplateColumns: cols }}
              data-testid="compare-row"
              data-label={label}
              data-differs={differs ? "1" : "0"}
            >
              <dt className="text-ink-soft">{label}</dt>
              {values.map((v, i) => (
                <dd key={cards[i]!.id} className={`min-w-0 break-words ${differs ? "font-semibold text-ink" : ""}`}>
                  {v}
                </dd>
              ))}
            </div>
          );
        })}
      </dl>
      <p className="border-t border-line px-3 py-2 text-[11px] text-ink-soft">Rows in bold are where these rings differ.</p>
    </div>
  );
}
