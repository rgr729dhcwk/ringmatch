import { createManualAdapter } from "./manual.adapter";
import { createSeedAdapter } from "./seed.adapter";
import type { SourceAdapter } from "./types";

/** All known adapters. */
export function getAdapters(): SourceAdapter[] {
  return [createSeedAdapter(), createManualAdapter()];
}

export function getEnabledAdapters(): SourceAdapter[] {
  return getAdapters().filter((a) => a.enabled);
}

export function getAdapter(id: string): SourceAdapter | undefined {
  return getAdapters().find((a) => a.id === id);
}
