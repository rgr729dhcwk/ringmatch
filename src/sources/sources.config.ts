import type { SourceConfig } from "./types";

/**
 * Per-source settings. Adding a source = write an adapter, register it in registry.ts,
 * and add its config here.
 */
export const SOURCES_CONFIG: Record<string, SourceConfig> = {
  seed: {
    enabled: true,
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

export function getSourceConfig(id: string): SourceConfig {
  const cfg = SOURCES_CONFIG[id];
  if (!cfg) throw new Error(`No config for source "${id}" in sources.config.ts`);
  return cfg;
}
