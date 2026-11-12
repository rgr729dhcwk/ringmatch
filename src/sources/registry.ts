import { createSeedAdapter } from "./seed.adapter";
import type { SourceAdapter } from "./types";

/** All known adapters. Real-retailer adapters plug in here in Milestone 4. */
export function getAdapters(): SourceAdapter[] {
  return [createSeedAdapter()];
}

export function getEnabledAdapters(): SourceAdapter[] {
  return getAdapters().filter((a) => a.enabled);
}
