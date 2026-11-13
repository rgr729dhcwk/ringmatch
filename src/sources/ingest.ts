import { NormalizedListingSchema, type ListingAttributes, type NormalizedListing, type ValidatedImage, type ValidatedVideo } from "@/lib/listing";
import type { RenderType } from "@/lib/taxonomy";
import { canRenderProcedurally } from "@/lib/visual";
import type { ImageChecker, VideoChecker } from "./imageCheck";
import type { SourceAdapter, SourceConfig } from "./types";

export type IngestOutcome = "accepted" | "fell_back_procedural" | "rejected";

export type ProcessedListing =
  | {
      outcome: "accepted" | "fell_back_procedural";
      listing: NormalizedListing;
      images: ValidatedImage[];
      /** Extra media (never the required visual). */
      videos: ValidatedVideo[];
      renderType: RenderType;
      reason: string | null;
      imageFailures: { url: string; reason: string }[];
    }
  | {
      outcome: "rejected";
      externalId: string | null;
      reason: string;
      imageFailures: { url: string; reason: string }[];
    };

export interface IngestStore {
  upsertListing(p: Extract<ProcessedListing, { listing: NormalizedListing }>): Promise<string>;
  log(entry: {
    sourceId: string;
    externalId: string | null;
    listingId: string | null;
    outcome: IngestOutcome;
    reason: string | null;
    detail: string | null;
  }): Promise<void>;
  /** Mark listings from this source not seen in this run as inactive. */
  deactivateMissing?(sourceId: string, seenExternalIds: string[]): Promise<number>;
}

function attributesFrom(l: NormalizedListing): Partial<ListingAttributes> {
  const { shape, cut, color, clarity, caratWeight, origin, centerStone, setting, prongs, metal, bandWidthMm, bandStyle, bandProfile } = l;
  return { shape, cut, color, clarity, caratWeight, origin, centerStone, setting, prongs, metal, bandWidthMm, bandStyle, bandProfile };
}

function renderTypeFor(images: ValidatedImage[]): RenderType {
  if (images.some((i) => i.kind === "photo")) return "photo";
  if (images.some((i) => i.kind === "360")) return "360";
  return "cad";
}

/** Simple sequential rate limiter. */
export function createRateLimiter(requestsPerSecond: number) {
  const gap = requestsPerSecond > 0 ? 1000 / requestsPerSecond : 0;
  let next = 0;
  return async () => {
    if (!gap) return;
    const now = Date.now();
    const wait = Math.max(0, next - now);
    next = Math.max(now, next) + gap;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  };
}

/**
 * The pipeline for one raw record:
 * normalize (Zod) → validate images (drop failures) → if none left, procedural fallback → else reject.
 */
export async function processListing(
  raw: Record<string, unknown>,
  adapter: Pick<SourceAdapter, "normalize">,
  config: SourceConfig,
  checkImage: ImageChecker,
  throttle: () => Promise<void> = async () => {},
  checkVideo?: VideoChecker,
): Promise<ProcessedListing> {
  const rawExternalId = typeof raw.externalId === "string" ? raw.externalId : null;
  let normalizedInput: unknown;
  try {
    normalizedInput = adapter.normalize(raw);
  } catch (e) {
    return { outcome: "rejected", externalId: rawExternalId, reason: `normalize threw: ${(e as Error).message}`, imageFailures: [] };
  }
  const parsed = NormalizedListingSchema.safeParse(normalizedInput);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    return { outcome: "rejected", externalId: rawExternalId, reason: `invalid listing: ${issues}`, imageFailures: [] };
  }
  const listing = parsed.data;

  const images: ValidatedImage[] = [];
  const imageFailures: { url: string; reason: string }[] = [];
  const candidates = listing.images.slice(0, config.imagePolicy.maxImages);
  for (const img of candidates) {
    if (!config.imagePolicy.validate) {
      imageFailures.push({ url: img.url, reason: "image validation disabled for this source; image not trusted" });
      continue;
    }
    const days = config.imagePolicy.trustValidatedWithinDays;
    if (days && img.width && img.height && img.validatedAt) {
      const age = (Date.now() - Date.parse(img.validatedAt)) / 86_400_000;
      if (age >= 0 && age <= days && Math.max(img.width, img.height) >= config.imagePolicy.minLongestSide) {
        images.push({ url: img.url, kind: img.kind, width: img.width, height: img.height });
        continue;
      }
    }
    await throttle();
    const res = await checkImage(img.url, img.kind);
    if (res.ok && Math.max(res.width, res.height) >= config.imagePolicy.minLongestSide) {
      images.push({ url: img.url, kind: img.kind, width: res.width, height: res.height });
    } else {
      imageFailures.push({ url: img.url, reason: res.ok ? `too small: ${res.width}x${res.height}` : res.reason });
    }
  }

  // Videos: optional extras. Trusted if a recent import checked them, otherwise checked now (if a checker
  // was given), otherwise left out.
  const videos: ValidatedVideo[] = [];
  for (const v of listing.videos.slice(0, 2)) {
    const days = config.imagePolicy.trustValidatedWithinDays;
    const fresh = days && v.validatedAt ? (Date.now() - Date.parse(v.validatedAt)) / 86_400_000 <= days : false;
    if (!fresh) {
      if (!checkVideo || !config.imagePolicy.validate) continue;
      await throttle();
      const res = await checkVideo(v.url);
      if (!res.ok) {
        imageFailures.push({ url: v.url, reason: `video: ${res.reason}` });
        continue;
      }
    }
    videos.push({ url: v.url, posterUrl: v.posterUrl ?? null, width: v.width ?? null, height: v.height ?? null });
  }

  if (images.length > 0) {
    return {
      outcome: "accepted",
      listing,
      images,
      videos,
      renderType: renderTypeFor(images),
      reason: imageFailures.length ? `${imageFailures.length} image(s) dropped` : null,
      imageFailures,
    };
  }

  if (canRenderProcedurally(attributesFrom(listing))) {
    return {
      outcome: "fell_back_procedural",
      listing,
      images: [],
      videos,
      renderType: "procedural",
      reason: candidates.length === 0 ? "no images provided" : "all images failed validation",
      imageFailures,
    };
  }

  return {
    outcome: "rejected",
    externalId: listing.externalId,
    reason:
      (candidates.length === 0 ? "no images provided" : "all images failed validation") +
      " and not enough attributes (shape or setting) for a procedural render",
    imageFailures,
  };
}

export type IngestSummary = { sourceId: string; accepted: number; fellBack: number; rejected: number; deactivated: number };

export async function ingestSource(
  adapter: SourceAdapter,
  config: SourceConfig,
  checkImage: ImageChecker,
  store: IngestStore,
  opts: { log?: (msg: string) => void } = {},
): Promise<IngestSummary> {
  const summary: IngestSummary = { sourceId: adapter.id, accepted: 0, fellBack: 0, rejected: 0, deactivated: 0 };
  const throttle = createRateLimiter(config.rateLimit.requestsPerSecond);
  const seen: string[] = [];
  for await (const raw of adapter.fetch()) {
    const p = await processListing(raw, adapter, config, checkImage, throttle);
    const detail = p.imageFailures.length ? JSON.stringify(p.imageFailures) : null;
    if (p.outcome === "rejected") {
      summary.rejected++;
      opts.log?.(`[${adapter.id}] rejected ${p.externalId ?? "(no id)"}: ${p.reason}`);
      await store.log({ sourceId: adapter.id, externalId: p.externalId, listingId: null, outcome: "rejected", reason: p.reason, detail });
      continue;
    }
    const listingId = await store.upsertListing(p);
    if (p.listing.externalId) seen.push(p.listing.externalId);
    if (p.outcome === "accepted") summary.accepted++;
    else summary.fellBack++;
    for (const f of p.imageFailures) opts.log?.(`[${adapter.id}] dropped image ${f.url}: ${f.reason}`);
    await store.log({
      sourceId: adapter.id,
      externalId: p.listing.externalId,
      listingId,
      outcome: p.outcome,
      reason: p.reason,
      detail,
    });
  }
  if (config.deactivateMissing && store.deactivateMissing) summary.deactivated = await store.deactivateMissing(adapter.id, seen);
  return summary;
}
