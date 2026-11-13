import type { NormalizedListing } from "@/lib/listing";

/** Whatever a source emits before normalization (shape is adapter-specific). */
export type RawListing = Record<string, unknown>;

export type ImagePolicy = {
  /** Check every image URL (HTTP 200, image/* content-type, size). Should stay true for real sources. */
  validate: boolean;
  /** Minimum longest side in px. */
  minLongestSide: number;
  /** Max images kept per listing. */
  maxImages: number;
};

export type SourceConfig = {
  enabled: boolean;
  imagePolicy: ImagePolicy;
  /**
   * After a full run, retire listings from this source that weren't in the run.
   * True for file-driven sources (seed); false for sources whose listings also live in the DB (manual).
   */
  deactivateMissing: boolean;
  /** Politeness limit for any HTTP the pipeline does on this source's behalf. */
  rateLimit: { requestsPerSecond: number };
  /** Shown on cards; legal/credit text for the data. */
  attribution: string;
};

export interface SourceAdapter {
  id: string;
  enabled: boolean;
  fetch(): AsyncIterable<RawListing>;
  /** Map a raw record to the normalized shape. Throw (or return invalid data) to reject. */
  normalize(raw: RawListing): unknown;
}

export type { NormalizedListing };
