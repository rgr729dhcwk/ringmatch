import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createImageChecker } from "@/sources/imageCheck";
import { ingestSource, processListing, type IngestStore } from "@/sources/ingest";
import { createManualAdapter, normalizeManual } from "@/sources/manual.adapter";
import { getSourceConfig } from "@/sources/sources.config";
import { mockFetch, pngHeader } from "./helpers";

const cfg = getSourceConfig("manual");
const { impl } = mockFetch({
  "https://shop.example/ring.png": { contentType: "image/png", body: pngHeader(1400, 1400) },
  "https://shop.example/thumb.png": { contentType: "image/png", body: pngHeader(200, 200) },
});
const checker = createImageChecker({ minLongestSide: 600, fetchImpl: impl });
const adapter = createManualAdapter("/nonexistent.json");

const form = {
  externalId: "m1",
  title: "1.2 ct oval halo",
  retailer: "Example Jewellers",
  sourceUrl: "https://shop.example/rings/123",
  price: "$4,250",
  images: "https://shop.example/thumb.png\n\nhttps://shop.example/ring.png\n",
  shape: "Oval",
  caratWeight: "1.2",
  setting: "Halo",
  metal: "",
  color: "",
};

describe("manual (admin) source", () => {
  it("turns form fields into a normalized listing", () => {
    const n = normalizeManual(form);
    expect(n).toMatchObject({
      sourceId: "manual",
      price: 4250,
      caratWeight: 1.2,
      metal: null,
      color: null,
      isSample: false,
      priceIsEstimate: false,
      attribution: "Details and photos: Example Jewellers",
      images: [
        { url: "https://shop.example/thumb.png", kind: "photo" },
        { url: "https://shop.example/ring.png", kind: "photo" },
      ],
    });
  });

  it("requires a link back to the shop", () => {
    expect(() => normalizeManual({ ...form, sourceUrl: "" })).toThrow(/link to the original listing/);
  });

  it("keeps good photos, drops small ones with a reason", async () => {
    const p = await processListing(form, adapter, cfg, checker);
    expect(p.outcome).toBe("accepted");
    if (p.outcome !== "accepted") return;
    expect(p.images.map((i) => i.url)).toEqual(["https://shop.example/ring.png"]);
    expect(p.imageFailures[0]!.reason).toMatch(/too small/);
    expect(p.listing.sourceUrl).toBe("https://shop.example/rings/123");
  });

  it("falls back to a 3D preview without usable photos, and rejects when it can't draw one", async () => {
    expect((await processListing({ ...form, images: "https://shop.example/missing.png" }, adapter, cfg, checker)).outcome).toBe("fell_back_procedural");
    const r = await processListing({ ...form, images: "", shape: "", setting: "" }, adapter, cfg, checker);
    expect(r.outcome).toBe("rejected");
  });

  it("rejects nonsense numbers and values outside the taxonomy", async () => {
    expect((await processListing({ ...form, price: "lots" }, adapter, cfg, checker)).outcome).toBe("rejected");
    expect((await processListing({ ...form, shape: "Triangle" }, adapter, cfg, checker)).outcome).toBe("rejected");
  });

  it("loads exported listings from its file and never retires DB-only listings", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "rm-"));
    const file = path.join(dir, "manual.json");
    await writeFile(file, JSON.stringify({ listings: [{ ...form, images: [{ url: "https://shop.example/ring.png", kind: "photo" }] }] }));
    let deactivateCalls = 0;
    const store: IngestStore = {
      upsertListing: async () => "id1",
      log: async () => {},
      deactivateMissing: async () => {
        deactivateCalls++;
        return 0;
      },
    };
    const s = await ingestSource(createManualAdapter(file), cfg, checker, store);
    expect(s).toMatchObject({ accepted: 1, rejected: 0 });
    expect(cfg.deactivateMissing).toBe(false);
    expect(deactivateCalls).toBe(0);
  });
});
