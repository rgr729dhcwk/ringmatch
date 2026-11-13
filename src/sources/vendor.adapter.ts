import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSourceConfig } from "./sources.config";
import type { RawListing, SourceAdapter } from "./types";
import type { Vendor } from "./vendors";

export const snapshotFile = (vendorId: string) => path.join(process.cwd(), "seed", "vendors", `${vendorId}.json`);

export function vendorNormalize(vendor: Vendor) {
  return (raw: RawListing) => ({
    ...raw,
    sourceId: vendor.id,
    retailer: vendor.name,
    attribution: `Photos and details © ${vendor.name}. Shown with a link to the original listing.`,
    isSample: false,
    priceIsEstimate: false,
  });
}

/** Loads the vendor's snapshot (seed/vendors/<id>.json), written by `npm run vendors:refresh`. */
export function createVendorAdapter(vendor: Vendor, file = snapshotFile(vendor.id)): SourceAdapter {
  return {
    id: vendor.id,
    enabled: getSourceConfig(vendor.id).enabled,
    async *fetch() {
      let json: { listings?: RawListing[] } = {};
      try {
        json = JSON.parse(await readFile(file, "utf8")) as { listings?: RawListing[] };
      } catch {
        return;
      }
      for (const item of json.listings ?? []) yield item;
    },
    normalize: vendorNormalize(vendor),
  };
}
