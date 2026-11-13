import { createManualAdapter } from "./manual.adapter";
import { createSeedAdapter } from "./seed.adapter";
import { createVendorAdapter } from "./vendor.adapter";
import { VENDORS } from "./vendors";
import type { SourceAdapter } from "./types";

/** All known adapters. */
export function getAdapters(): SourceAdapter[] {
  return [createSeedAdapter(), createManualAdapter(), ...VENDORS.map((v) => createVendorAdapter(v))];
}

export function getEnabledAdapters(): SourceAdapter[] {
  return getAdapters().filter((a) => a.enabled);
}

export function getAdapter(id: string): SourceAdapter | undefined {
  return getAdapters().find((a) => a.id === id);
}
