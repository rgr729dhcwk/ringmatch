/**
 * HARD REQUIREMENT: every card must have a visual. These tests fail if any seed listing,
 * or any card in a built deck, could render without one.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDeck, toCard, type ListingRow } from "@/lib/card";
import type { NormalizedListing, ValidatedImage } from "@/lib/listing";
import { isValidVisual } from "@/lib/visual";
import { orderDeck } from "@/recs/deckOrder";
import { createImageChecker } from "@/sources/imageCheck";
import { processListing } from "@/sources/ingest";
import { createSeedAdapter } from "@/sources/seed.adapter";
import { getSourceConfig } from "@/sources/sources.config";

function rowFrom(l: NormalizedListing, images: ValidatedImage[], renderType: string, id: string): ListingRow {
  return {
    id,
    title: l.title,
    retailer: l.retailer,
    attribution: l.attribution,
    sourceUrl: l.sourceUrl,
    isSample: l.isSample,
    price: l.price,
    currency: l.currency,
    priceIsEstimate: l.priceIsEstimate,
    renderType,
    shape: l.shape,
    cut: l.cut,
    color: l.color,
    clarity: l.clarity,
    caratWeight: l.caratWeight,
    origin: l.origin,
    centerStone: l.centerStone,
    setting: l.setting,
    prongs: l.prongs,
    metal: l.metal,
    bandWidthMm: l.bandWidthMm,
    bandStyle: l.bandStyle,
    bandProfile: l.bandProfile,
    images: images.map((img, position) => ({ ...img, position })),
  };
}

async function ingestSeedRows(): Promise<{ rows: ListingRow[]; total: number; rejected: string[] }> {
  const adapter = createSeedAdapter(path.join(process.cwd(), "seed", "listings.json"));
  const cfg = getSourceConfig("seed");
  // Offline: remote URLs fail (so they must fall back); site-relative seed images are checked on disk.
  const checker = createImageChecker({ minLongestSide: cfg.imagePolicy.minLongestSide, offline: true });
  const rows: ListingRow[] = [];
  const rejected: string[] = [];
  let total = 0;
  for await (const raw of adapter.fetch()) {
    total++;
    const p = await processListing(raw, adapter, cfg, checker);
    if (p.outcome === "rejected") rejected.push(`${p.externalId}: ${p.reason}`);
    else rows.push(rowFrom(p.listing, p.images, p.renderType, p.listing.externalId ?? `row-${total}`));
  }
  return { rows, total, rejected };
}

function assertVisual(card: ReturnType<typeof toCard>, label: string) {
  expect(card, `${label} produced no card`).not.toBeNull();
  expect(isValidVisual(card!.visual), `${label} has no valid visual`).toBe(true);
  if (card!.visual.kind === "image") {
    expect(card!.visual.images.length).toBeGreaterThan(0);
    for (const img of card!.visual.images) expect(Math.max(img.width, img.height)).toBeGreaterThanOrEqual(600);
  } else {
    const p = card!.visual.params;
    for (const k of ["shape", "caratWeight", "setting", "prongs", "metal", "bandWidthMm", "bandStyle", "bandProfile", "centerStone"] as const) {
      expect(p[k], `${label} procedural param ${k}`).toBeTruthy();
    }
  }
}

describe("visual guarantee", () => {
  it("every seed listing ingests and becomes a card with a visual", async () => {
    const { rows, total, rejected } = await ingestSeedRows();
    expect(rejected).toEqual([]);
    expect(total).toBeGreaterThanOrEqual(40);
    expect(rows).toHaveLength(total);
    for (const row of rows) assertVisual(toCard(row), row.id);
  });

  it("every card in a built deck has a visual (and the deck keeps every seed listing)", async () => {
    const { rows } = await ingestSeedRows();
    const deck = orderDeck(buildDeck(rows).map((c) => ({ ...c, shape: c.specs.find((s) => s.label === "Shape")?.value })), "user-1");
    expect(deck).toHaveLength(rows.length);
    for (const card of deck) assertVisual(card, card.id);
  });

  it("the seed covers every shape, setting and metal", async () => {
    const { SHAPES, SETTINGS, METALS, PRONGS } = await import("@/lib/taxonomy");
    const { rows } = await ingestSeedRows();
    for (const s of SHAPES) expect(rows.some((r) => r.shape === s), s).toBe(true);
    for (const s of SETTINGS) expect(rows.some((r) => r.setting === s), s).toBe(true);
    for (const m of METALS) expect(rows.some((r) => r.metal === m), m).toBe(true);
    for (const p of PRONGS) expect(rows.some((r) => r.prongs === p), p).toBe(true);
  });

  it("toCard refuses rows that have neither a usable image nor renderable attributes", () => {
    const empty: ListingRow = {
      id: "x", title: "x", retailer: "r", attribution: "a", sourceUrl: null, isSample: false, price: null,
      currency: "USD", priceIsEstimate: false, renderType: "photo", shape: null, cut: null, color: null,
      clarity: null, caratWeight: null, origin: null, centerStone: null, setting: null, prongs: null,
      metal: "Platinum", bandWidthMm: null, bandStyle: null, bandProfile: null,
      images: [{ url: "https://x/tiny.jpg", kind: "photo", width: 200, height: 200, position: 0 }],
    };
    expect(toCard(empty)).toBeNull();
    expect(buildDeck([empty])).toEqual([]);
    // With a usable image it is fine, even with no attributes.
    const withImage = { ...empty, images: [{ ...empty.images[0]!, width: 1200, height: 900 }] };
    expect(toCard(withImage)?.visual.kind).toBe("image");
    // With a shape it falls back to procedural.
    expect(toCard({ ...empty, shape: "Oval" })?.visual.kind).toBe("procedural");
  });

  it("invalid taxonomy values in a row never crash and never yield a visual-less card", () => {
    const row: ListingRow = {
      id: "y", title: "y", retailer: "r", attribution: "a", sourceUrl: "https://shop.example/y", isSample: false,
      price: 1000, currency: "USD", priceIsEstimate: false, renderType: "procedural", shape: "Blob", cut: null,
      color: "ZZ", clarity: null, caratWeight: 99, origin: null, centerStone: null, setting: "Halo", prongs: "12",
      metal: "Tin", bandWidthMm: null, bandStyle: null, bandProfile: null, images: [],
    };
    const card = toCard(row);
    assertVisual(card, "y");
    expect(card!.visual.kind === "procedural" && card!.visual.params.shape).toBe("Round");
  });

  it("sample cards have no link-out and an estimated price", async () => {
    const { rows } = await ingestSeedRows();
    for (const row of rows) {
      const card = toCard(row)!;
      expect(card.isSample).toBe(true);
      expect(card.sourceUrl).toBeNull();
      expect(card.retailer).toBe("RingMatch Sample");
      expect(card.price?.isEstimate).toBe(true);
    }
  });
});
