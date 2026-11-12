import type { SourceConfig } from "./types";

/**
 * Per-source settings. Adding a source = write an adapter, register it in registry.ts,
 * and add its config here. Milestone 1 ships only the seed source.
 */
export const SOURCES_CONFIG: Record<string, SourceConfig> = {
  seed: {
    enabled: true,
    imagePolicy: { validate: true, minLongestSide: 600, maxImages: 8 },
    rateLimit: { requestsPerSecond: 5 },
    attribution: "RingMatch sample data — illustrative, not a real listing",
  },
};

export function getSourceConfig(id: string): SourceConfig {
  const cfg = SOURCES_CONFIG[id];
  if (!cfg) throw new Error(`No config for source "${id}" in sources.config.ts`);
  return cfg;
}
