import { randomUUID } from "node:crypto";
import type { NormalizedListing } from "@/lib/listing";
import { createImageChecker } from "@/sources/imageCheck";
import { createRateLimiter, processListing, type IngestOutcome } from "@/sources/ingest";
import { createManualAdapter, MANUAL_SOURCE_ID } from "@/sources/manual.adapter";
import { createPrismaIngestStore } from "@/sources/prismaStore";
import { getSourceConfig } from "@/sources/sources.config";
import { db } from "./db";

export type SaveResult = {
  outcome: IngestOutcome;
  reason: string | null;
  imageFailures: { url: string; reason: string }[];
  listingId: string | null;
  imagesKept: number;
};

/** Run one hand-entered listing through the normal ingest pipeline (image checks, fallback, logging). */
export async function saveManualListing(raw: Record<string, unknown>): Promise<SaveResult> {
  const cfg = getSourceConfig(MANUAL_SOURCE_ID);
  const adapter = createManualAdapter();
  const store = createPrismaIngestStore(db);
  const checker = createImageChecker({
    minLongestSide: cfg.imagePolicy.minLongestSide,
    offline: process.env.RINGMATCH_OFFLINE === "1",
  });
  const externalId = (typeof raw.externalId === "string" && raw.externalId.trim()) || `manual-${randomUUID().slice(0, 8)}`;
  const p = await processListing({ ...raw, externalId }, adapter, cfg, checker, createRateLimiter(cfg.rateLimit.requestsPerSecond));
  const detail = p.imageFailures.length ? JSON.stringify(p.imageFailures) : null;
  if (p.outcome === "rejected") {
    await store.log({ sourceId: MANUAL_SOURCE_ID, externalId, listingId: null, outcome: "rejected", reason: p.reason, detail });
    return { outcome: "rejected", reason: p.reason, imageFailures: p.imageFailures, listingId: null, imagesKept: 0 };
  }
  const listingId = await store.upsertListing(p);
  await store.log({ sourceId: MANUAL_SOURCE_ID, externalId, listingId, outcome: p.outcome, reason: p.reason, detail });
  return { outcome: p.outcome, reason: p.reason, imageFailures: p.imageFailures, listingId, imagesKept: p.images.length };
}

export async function listManualListings() {
  return db.listing.findMany({
    where: { sourceId: MANUAL_SOURCE_ID },
    orderBy: { createdAt: "desc" },
    include: { images: { orderBy: { position: "asc" } }, ingestLogs: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
}

export async function getManualListing(id: string) {
  return db.listing.findFirst({ where: { id, sourceId: MANUAL_SOURCE_ID }, include: { images: { orderBy: { position: "asc" } }, videos: { orderBy: { position: "asc" } } } });
}

export async function setManualActive(id: string, active: boolean) {
  await db.listing.updateMany({ where: { id, sourceId: MANUAL_SOURCE_ID }, data: { active } });
}

/** Recent pipeline results for hand-entered listings (sample-data checks are left out). */
export async function recentIngestLogs(limit = 25) {
  return db.ingestLog.findMany({ where: { sourceId: MANUAL_SOURCE_ID }, orderBy: { createdAt: "desc" }, take: limit });
}

type ExportedListing = Partial<NormalizedListing> & { externalId: string; active?: boolean };

/** All manual listings in the seed/manual-listings.json format (active ones only). */
export async function exportManualListings(): Promise<{ $comment: string; listings: ExportedListing[] }> {
  const rows = await db.listing.findMany({
    where: { sourceId: MANUAL_SOURCE_ID, active: true },
    orderBy: { createdAt: "asc" },
    include: { images: { orderBy: { position: "asc" } }, videos: { orderBy: { position: "asc" } } },
  });
  return {
    $comment: "Real listings added on /admin and exported. Loaded on every start (source: manual).",
    listings: rows.map((r) => ({
      externalId: r.externalId ?? r.id,
      title: r.title,
      retailer: r.retailer,
      sourceUrl: r.sourceUrl,
      attribution: r.attribution,
      price: r.price,
      currency: r.currency as NormalizedListing["currency"],
      priceIsEstimate: r.priceIsEstimate,
      shape: r.shape as NormalizedListing["shape"],
      cut: r.cut as NormalizedListing["cut"],
      color: r.color as NormalizedListing["color"],
      clarity: r.clarity as NormalizedListing["clarity"],
      caratWeight: r.caratWeight,
      origin: r.origin as NormalizedListing["origin"],
      centerStone: r.centerStone as NormalizedListing["centerStone"],
      setting: r.setting as NormalizedListing["setting"],
      prongs: r.prongs as NormalizedListing["prongs"],
      metal: r.metal as NormalizedListing["metal"],
      bandWidthMm: r.bandWidthMm,
      bandStyle: r.bandStyle as NormalizedListing["bandStyle"],
      bandProfile: r.bandProfile as NormalizedListing["bandProfile"],
      images: r.images.map((i) => ({ url: i.url, kind: i.kind as "photo" })),
    })),
  };
}

/** Import listings (exported JSON). Each one goes through the full pipeline again. */
export async function importManualListings(json: unknown): Promise<{ results: (SaveResult & { title: string })[]; error?: string }> {
  const list = (json && typeof json === "object" ? (json as { listings?: unknown }).listings : null) ?? json;
  if (!Array.isArray(list)) return { results: [], error: 'Expected {"listings": [...]} or a list of listings.' };
  const results: (SaveResult & { title: string })[] = [];
  for (const item of list.slice(0, 500)) {
    const raw = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    results.push({ ...(await saveManualListing(raw)), title: String(raw.title ?? "(untitled)") });
  }
  return { results };
}
