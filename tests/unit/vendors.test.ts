import { describe, expect, it } from "vitest";
import { buildDeck, type ListingRow } from "@/lib/card";
import { isValidVisual } from "@/lib/visual";
import { createImageChecker } from "@/sources/imageCheck";
import { processListing } from "@/sources/ingest";
import { fetchVendorListings } from "@/sources/shopify";
import { getSourceConfig } from "@/sources/sources.config";
import { createVendorAdapter } from "@/sources/vendor.adapter";
import { isEngagementRing, VENDORS, type ShopifyProduct, type Vendor } from "@/sources/vendors";
import { mockFetch } from "./helpers";

const product = (o: Partial<ShopifyProduct>): ShopifyProduct => ({
  id: 1,
  title: "1.50 Oval Lab Diamond in Halo",
  handle: "oval-halo",
  product_type: "Lab Grown Engagement Rings",
  tags: ["14k Yellow Gold"],
  body_html: "<p>Shape: Oval<br>Carat: 1.50<br>Color: G<br>Clarity: VS2</p>",
  variants: [{ price: "4200.00", available: true }],
  images: [{ src: "https://cdn.example/oval.jpg", width: 1800, height: 1800 }],
  ...o,
});

const vendor: Vendor = { id: "testshop", name: "Test Shop", origin: "https://shop.test", platform: "shopify", maxListings: 10, maxPages: 2, description: "" };

describe("engagement ring filter", () => {
  it("keeps available engagement rings; drops loose stones, bands, jewellery, sold items, no-photo items", () => {
    expect(isEngagementRing(product({}))).toBe(true);
    expect(isEngagementRing(product({ product_type: "Diamond", title: "Round #826657226" }))).toBe(false);
    expect(isEngagementRing(product({ product_type: "Vault Exclusive", title: "2.85 Radiant Natural Diamond", tags: ["bridal"] }))).toBe(false);
    expect(isEngagementRing(product({ title: "Pavé wedding band", product_type: "Bridal" }))).toBe(false);
    expect(isEngagementRing(product({ title: "Diamond studs", product_type: "Earrings", tags: ["bridal"] }))).toBe(false);
    expect(isEngagementRing(product({ variants: [{ price: "1", available: false }] }))).toBe(false);
    expect(isEngagementRing(product({ images: [] }))).toBe(false);
    expect(isEngagementRing(product({ title: "The Pavé Nest", options: [{ name: "Diamond Shape" }, { name: "Metal" }] }))).toBe(false);
    expect(isEngagementRing(product({ options: [{ name: "Title" }] }))).toBe(true);
    expect(isEngagementRing(product({ product_type: "", tags: ["Necklaces"], title: "Gold chain" }))).toBe(false);
  });
});

describe("reading a store feed", () => {
  it("respects robots.txt, filters, and maps products to listings with a link back", async () => {
    const { impl, calls } = mockFetch({
      "https://shop.test/robots.txt": { contentType: "text/plain", body: "User-agent: *\nDisallow: /checkout" },
      "https://shop.test/products.json?limit=250&page=1": {
        contentType: "application/json",
        body: JSON.stringify({ products: [product({}), product({ id: 2, product_type: "Diamond", title: "Round #123456789" })] }),
      },
      "https://shop.test/products.json?limit=250&page=2": { contentType: "application/json", body: JSON.stringify({ products: [] }) },
    });
    const raws = await fetchVendorListings(vendor, { fetchImpl: impl, requestsPerSecond: 0 });
    expect(raws).toHaveLength(1);
    expect(raws[0]).toMatchObject({
      externalId: "1",
      sourceUrl: "https://shop.test/products/oval-halo",
      price: 4200,
      shape: "Oval",
      setting: "Halo",
      metal: "Yellow Gold",
      origin: "Lab-grown",
      caratWeight: 1.5,
      color: "G",
      clarity: "VS2",
      images: [{ url: "https://cdn.example/oval.jpg", kind: "photo" }],
    });
    expect(calls[0]).toBe("https://shop.test/robots.txt");
  });

  it("stops when robots.txt disallows the feed", async () => {
    const { impl, calls } = mockFetch({
      "https://shop.test/robots.txt": { contentType: "text/plain", body: "User-agent: *\nDisallow: /products.json" },
    });
    expect(await fetchVendorListings(vendor, { fetchImpl: impl, requestsPerSecond: 0 })).toEqual([]);
    expect(calls).toEqual(["https://shop.test/robots.txt"]);
  });
});

describe("imported retailer snapshots (seed/vendors/*.json)", () => {
  it("every imported listing becomes a card with a visual, a retailer credit and a link to the shop", async () => {
    let total = 0;
    for (const v of VENDORS) {
      const adapter = createVendorAdapter(v);
      // Offline: if a snapshot ever got too old to trust, listings must still fall back to a 3D render.
      const checker = createImageChecker({ minLongestSide: 600, offline: true });
      const rows: ListingRow[] = [];
      for await (const raw of adapter.fetch()) {
        const p = await processListing(raw, adapter, getSourceConfig(v.id), checker);
        expect(p.outcome, `${v.id} ${String(raw.title)}`).not.toBe("rejected");
        if (p.outcome === "rejected") continue;
        const l = p.listing;
        rows.push({
          ...l,
          id: `${v.id}-${l.externalId}`,
          renderType: p.renderType,
          images: p.images.map((im, position) => ({ ...im, position })),
        } as unknown as ListingRow);
      }
      const deck = buildDeck(rows);
      expect(deck).toHaveLength(rows.length);
      for (const c of deck) {
        expect(isValidVisual(c.visual)).toBe(true);
        expect(c.retailer).toBe(v.name);
        expect(c.sourceUrl).toMatch(new RegExp(`^${v.origin.replace(/[.]/g, "\\.")}/products/`));
        expect(c.isSample).toBe(false);
      }
      total += deck.length;
    }
    expect(total).toBeGreaterThanOrEqual(45);
  });
});

describe("retailer videos", async () => {
  const { pickVideos } = await import("@/sources/shopify");
  const { checkVideo } = await import("@/sources/imageCheck");

  it("picks the mp4 closest to 720p and keeps the poster", () => {
    const v = pickVideos([
      { media_type: "image" },
      {
        media_type: "video",
        preview_image: { src: "//cdn.example/poster.jpg" },
        sources: [
          { format: "m3u8", url: "https://cdn.example/v.m3u8", height: 1080 },
          { format: "mp4", url: "https://cdn.example/v480.mp4", height: 480 },
          { format: "mp4", url: "https://cdn.example/v1080.mp4", height: 1080 },
          { format: "mp4", url: "https://cdn.example/v720.mp4", height: 720 },
        ],
      },
      { media_type: "external_video" },
    ]);
    expect(v).toEqual([{ url: "https://cdn.example/v720.mp4", posterUrl: "https://cdn.example/poster.jpg", width: undefined, height: 720 }]);
  });

  it("checks a video: 206/200 with video/* passes; html or 404 fails; offline never fetches", async () => {
    const { impl, calls } = mockFetch({
      "https://cdn.example/ok.mp4": { status: 206, contentType: "video/mp4", body: "x" },
      "https://cdn.example/page.mp4": { contentType: "text/html", body: "<html>" },
    });
    expect((await checkVideo("https://cdn.example/ok.mp4", { fetchImpl: impl })).ok).toBe(true);
    expect(await checkVideo("https://cdn.example/page.mp4", { fetchImpl: impl })).toMatchObject({ ok: false });
    expect(await checkVideo("https://cdn.example/missing.mp4", { fetchImpl: impl })).toMatchObject({ ok: false, reason: "HTTP 404" });
    const n = calls.length;
    expect((await checkVideo("https://cdn.example/ok.mp4", { fetchImpl: impl, offline: true })).ok).toBe(false);
    expect(calls.length).toBe(n);
  });

  it("videos are extras: kept when recently checked, dropped otherwise, and never replace the visual", async () => {
    const cfg = getSourceConfig("ringconcierge");
    const adapter = { normalize: (r: Record<string, unknown>) => ({ ...r, sourceId: "ringconcierge", retailer: "Ring Concierge", attribution: "x" }) };
    const offline = createImageChecker({ minLongestSide: 600, offline: true });
    const recent = new Date().toISOString();
    const raw = {
      externalId: "v1",
      title: "Oval halo",
      sourceUrl: "https://shop.test/products/v1",
      shape: "Oval",
      images: [{ url: "https://cdn.example/a.jpg", kind: "photo", width: 1800, height: 1800, validatedAt: recent }],
      videos: [
        { url: "https://cdn.example/fresh.mp4", validatedAt: recent },
        { url: "https://cdn.example/unchecked.mp4" },
      ],
    };
    const p = await processListing(raw, adapter, cfg, offline);
    expect(p.outcome).toBe("accepted");
    if (p.outcome === "rejected") return;
    expect(p.videos.map((v) => v.url)).toEqual(["https://cdn.example/fresh.mp4"]);
    // A listing with only a video (no usable photo) still needs the 3D fallback for its visual.
    const noPhoto = await processListing({ ...raw, images: [] }, adapter, cfg, offline);
    expect(noPhoto.outcome).toBe("fell_back_procedural");
  });
});
