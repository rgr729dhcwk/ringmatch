import type { SourceConfig } from "./types";
import { VENDORS } from "./vendors";

/**
 * Per-source settings. Adding a source = write an adapter, register it in registry.ts,
 * and add its config here.
 */
export const SOURCES_CONFIG: Record<string, SourceConfig> = {
  seed: {
    // The 43 illustrative sample rings. Kept for development and tests; switched off on the live
    // site (RINGMATCH_SAMPLES=off in start:render) now that real retailer listings exist.
    enabled: process.env.RINGMATCH_SAMPLES !== "off",
    imagePolicy: { validate: true, minLongestSide: 600, maxImages: 8 },
    deactivateMissing: true,
    rateLimit: { requestsPerSecond: 5 },
    attribution: "RingMatch sample data — illustrative, not a real listing",
  },
  /** Real listings entered by hand on /admin (and exported to seed/manual-listings.json to keep them). */
  manual: {
    enabled: true,
    imagePolicy: { validate: true, minLongestSide: 600, maxImages: 8 },
    deactivateMissing: false,
    rateLimit: { requestsPerSecond: 2 },
    attribution: "Details and photos from the retailer's listing, entered by hand for personal comparison",
  },
};

// One source per retailer in vendors.ts (imported snapshots; photos were checked at import time).
for (const v of VENDORS) {
  SOURCES_CONFIG[v.id] = {
    enabled: true,
    imagePolicy: { validate: true, minLongestSide: 600, maxImages: 6, trustValidatedWithinDays: 180 },
    deactivateMissing: true,
    rateLimit: { requestsPerSecond: 2 },
    attribution: `Photos and details © ${v.name}`,
  };
}

export function getSourceConfig(id: string): SourceConfig {
  const cfg = SOURCES_CONFIG[id];
  if (!cfg) throw new Error(`No config for source "${id}" in sources.config.ts`);
  return cfg;
}
