import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSourceConfig } from "./sources.config";
import type { RawListing, SourceAdapter } from "./types";

export const SEED_SOURCE_ID = "seed";
export const DEFAULT_SEED_FILE = path.join(process.cwd(), "seed", "listings.json");

/** Reads seed/listings.json. The file is { "listings": [ ... ] }. */
export function createSeedAdapter(file: string = DEFAULT_SEED_FILE): SourceAdapter {
  const cfg = getSourceConfig(SEED_SOURCE_ID);
  return {
    id: SEED_SOURCE_ID,
    enabled: cfg.enabled,
    async *fetch() {
      const json = JSON.parse(await readFile(file, "utf8")) as { listings?: RawListing[] };
      for (const item of json.listings ?? []) yield item;
    },
    normalize(raw: RawListing) {
      const sample = raw.isSample !== false;
      return {
        ...raw,
        sourceId: SEED_SOURCE_ID,
        retailer: raw.retailer ?? (sample ? "RingMatch Sample" : undefined),
        attribution: raw.attribution ?? cfg.attribution,
        isSample: sample,
        // Sample prices are always market estimates.
        priceIsEstimate: sample ? true : (raw.priceIsEstimate ?? false),
      };
    },
  };
}
