import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSourceConfig } from "./sources.config";
import type { RawListing, SourceAdapter } from "./types";

export const MANUAL_SOURCE_ID = "manual";
export const DEFAULT_MANUAL_FILE = path.join(process.cwd(), "seed", "manual-listings.json");

const ATTRIBUTE_KEYS = [
  "shape", "cut", "color", "clarity", "origin", "centerStone", "setting", "prongs", "metal", "bandStyle", "bandProfile",
] as const;

/** "" / undefined → null; trims strings. */
const text = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/** Accepts numbers or strings like "$4,250" / "1.2". Empty → null; junk → NaN (Zod then rejects it). */
const num = (v: unknown): number | null => {
  if (typeof v === "number") return v;
  const s = text(v);
  if (s == null) return null;
  return Number(s.replace(/[$,\s]/g, ""));
};

/** Images can be an array of URLs / {url, kind} objects, or one URL per line. */
function images(v: unknown): { url: string; kind: string }[] {
  const items = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\r?\n/) : [];
  return items.flatMap((it) => {
    if (typeof it === "string") {
      const url = it.trim();
      return url ? [{ url, kind: "photo" }] : [];
    }
    if (it && typeof it === "object" && typeof (it as { url?: unknown }).url === "string") {
      const o = it as { url: string; kind?: string };
      return o.url.trim() ? [{ url: o.url.trim(), kind: o.kind ?? "photo" }] : [];
    }
    return [];
  });
}

/** Turn a hand-entered listing (form fields or exported JSON) into the normalized shape. */
export function normalizeManual(raw: RawListing) {
  const out: Record<string, unknown> = {
    sourceId: MANUAL_SOURCE_ID,
    externalId: text(raw.externalId),
    sourceUrl: text(raw.sourceUrl),
    retailer: text(raw.retailer),
    title: text(raw.title),
    price: num(raw.price),
    currency: text(raw.currency) ?? "USD",
    priceIsEstimate: raw.priceIsEstimate === true || raw.priceIsEstimate === "on" || raw.priceIsEstimate === "true",
    isSample: false,
    caratWeight: num(raw.caratWeight),
    bandWidthMm: num(raw.bandWidthMm),
    images: images(raw.images),
  };
  for (const k of ATTRIBUTE_KEYS) out[k] = text(raw[k]);
  const retailer = out.retailer as string | null;
  out.attribution = text(raw.attribution) ?? (retailer ? `Details and photos: ${retailer}` : getSourceConfig(MANUAL_SOURCE_ID).attribution);
  // Real listings must link back to the shop.
  if (!out.sourceUrl) throw new Error("a link to the original listing is required");
  return out;
}

/** Reads seed/manual-listings.json — real listings exported from /admin so they survive restarts. */
export function createManualAdapter(file: string = DEFAULT_MANUAL_FILE): SourceAdapter {
  return {
    id: MANUAL_SOURCE_ID,
    enabled: getSourceConfig(MANUAL_SOURCE_ID).enabled,
    async *fetch() {
      let json: { listings?: RawListing[] } = {};
      try {
        json = JSON.parse(await readFile(file, "utf8")) as { listings?: RawListing[] };
      } catch {
        return; // no file yet = nothing to load
      }
      for (const item of json.listings ?? []) yield item;
    },
    normalize: normalizeManual,
  };
}
