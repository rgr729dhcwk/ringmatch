import { describe, expect, it } from "vitest";
import { createImageChecker } from "@/sources/imageCheck";
import { ingestSource, processListing, type IngestStore } from "@/sources/ingest";
import type { SourceAdapter, SourceConfig } from "@/sources/types";
import { mockFetch, pngHeader } from "./helpers";

const config: SourceConfig = {
  enabled: true,
  imagePolicy: { validate: true, minLongestSide: 600, maxImages: 8 },
  rateLimit: { requestsPerSecond: 0 },
  attribution: "test",
};

const { impl } = mockFetch({
  "https://cdn.test/big.png": { contentType: "image/png", body: pngHeader(1600, 1600) },
  "https://cdn.test/small.png": { contentType: "image/png", body: pngHeader(300, 300) },
  "https://cdn.test/html": { contentType: "text/html", body: "<html/>" },
  "https://cdn.test/gone.png": { status: 410, contentType: "image/png" },
});
const checker = createImageChecker({ minLongestSide: 600, fetchImpl: impl });

const adapter = (items: Record<string, unknown>[]): SourceAdapter => ({
  id: "test",
  enabled: true,
  async *fetch() {
    yield* items;
  },
  normalize: (raw) => ({ sourceId: "test", retailer: "Test Jeweler", attribution: "test", ...raw }),
});

const base = { title: "Ring", externalId: "x1" };

describe("processListing", () => {
  it("accepts a listing with a valid image and drops the invalid ones (logging why)", async () => {
    const p = await processListing(
      {
        ...base,
        shape: "Oval",
        images: [
          { url: "https://cdn.test/small.png" },
          { url: "https://cdn.test/big.png", kind: "photo" },
          { url: "https://cdn.test/html" },
          { url: "https://cdn.test/gone.png" },
        ],
      },
      adapter([]),
      config,
      checker,
    );
    expect(p.outcome).toBe("accepted");
    if (p.outcome !== "accepted") return;
    expect(p.images).toEqual([{ url: "https://cdn.test/big.png", kind: "photo", width: 1600, height: 1600 }]);
    expect(p.renderType).toBe("photo");
    expect(p.imageFailures.map((f) => f.reason)).toEqual([
      expect.stringMatching(/too small/),
      expect.stringMatching(/not image/),
      "HTTP 410",
    ]);
  });

  it("falls back to procedural when every image fails but attributes allow a render", async () => {
    const p = await processListing(
      { ...base, setting: "Halo", images: [{ url: "https://cdn.test/small.png" }] },
      adapter([]),
      config,
      checker,
    );
    expect(p.outcome).toBe("fell_back_procedural");
    if (p.outcome === "fell_back_procedural") {
      expect(p.renderType).toBe("procedural");
      expect(p.reason).toBe("all images failed validation");
    }
  });

  it("falls back to procedural for attribute-only listings", async () => {
    const p = await processListing({ ...base, shape: "Pear" }, adapter([]), config, checker);
    expect(p).toMatchObject({ outcome: "fell_back_procedural", reason: "no images provided" });
  });

  it("rejects when there are no valid images and no shape/setting to render from", async () => {
    const p = await processListing(
      { ...base, metal: "Platinum", images: [{ url: "https://cdn.test/gone.png" }] },
      adapter([]),
      config,
      checker,
    );
    expect(p.outcome).toBe("rejected");
    if (p.outcome === "rejected") expect(p.reason).toMatch(/not enough attributes/);
  });

  it("rejects attribute values outside the taxonomy", async () => {
    const p = await processListing({ ...base, shape: "Triangle" }, adapter([]), config, checker);
    expect(p.outcome).toBe("rejected");
    if (p.outcome === "rejected") expect(p.reason).toMatch(/shape/);
  });

  it("rejects when normalize throws", async () => {
    const bad = { ...adapter([]), normalize: () => { throw new Error("boom"); } };
    const p = await processListing(base, bad, config, checker);
    expect(p).toMatchObject({ outcome: "rejected", reason: "normalize threw: boom" });
  });

  it("does not trust images when the source's image policy disables validation", async () => {
    const p = await processListing(
      { ...base, shape: "Round", images: [{ url: "https://cdn.test/big.png" }] },
      adapter([]),
      { ...config, imagePolicy: { ...config.imagePolicy, validate: false } },
      checker,
    );
    expect(p.outcome).toBe("fell_back_procedural");
  });
});

describe("ingestSource", () => {
  it("stores accepted/fallback listings and logs every outcome", async () => {
    const stored: string[] = [];
    const logs: { outcome: string; reason: string | null; detail: string | null }[] = [];
    const store: IngestStore = {
      async upsertListing(p) {
        stored.push(p.listing.externalId ?? "?");
        return `id-${stored.length}`;
      },
      async log(e) {
        logs.push(e);
      },
    };
    const summary = await ingestSource(
      adapter([
        { title: "A", externalId: "a", shape: "Round", images: [{ url: "https://cdn.test/big.png" }] },
        { title: "B", externalId: "b", shape: "Heart", images: [{ url: "https://cdn.test/gone.png" }] },
        { title: "C", externalId: "c" },
      ]),
      config,
      checker,
      store,
    );
    expect(summary).toMatchObject({ accepted: 1, fellBack: 1, rejected: 1 });
    expect(stored).toEqual(["a", "b"]);
    expect(logs.map((l) => l.outcome)).toEqual(["accepted", "fell_back_procedural", "rejected"]);
    expect(JSON.parse(logs[1]!.detail!)).toEqual([{ url: "https://cdn.test/gone.png", reason: "HTTP 410" }]);
  });
});
