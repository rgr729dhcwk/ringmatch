import type { PrismaClient } from "@prisma/client";
import type { IngestStore } from "./ingest";

/** IngestStore backed by Prisma. Kept separate so the pipeline itself stays unit-testable. */
export function createPrismaIngestStore(db: PrismaClient): IngestStore {
  return {
    async upsertListing(p) {
      const l = p.listing;
      const data = {
        sourceUrl: l.sourceUrl,
        retailer: l.retailer,
        attribution: l.attribution,
        title: l.title,
        price: l.price,
        currency: l.currency,
        priceIsEstimate: l.priceIsEstimate,
        isSample: l.isSample,
        shape: l.shape,
        cut: l.cut,
        color: l.color,
        clarity: l.clarity,
        caratWeight: l.caratWeight,
        origin: l.origin,
        centerStone: l.centerStone,
        setting: l.setting,
        prongs: l.prongs,
        metal: l.metal,
        bandWidthMm: l.bandWidthMm,
        bandStyle: l.bandStyle,
        bandProfile: l.bandProfile,
        renderType: p.renderType,
        has360: p.images.some((i) => i.kind === "360"),
        lastSeenAt: new Date(),
        active: true,
      };
      const now = new Date();
      const images = p.images.map((img, position) => ({ ...img, position, validatedAt: now }));
      return db.$transaction(async (tx) => {
        const existing = l.externalId
          ? await tx.listing.findUnique({ where: { sourceId_externalId: { sourceId: l.sourceId, externalId: l.externalId } } })
          : null;
        if (existing) {
          await tx.listingImage.deleteMany({ where: { listingId: existing.id } });
          await tx.listing.update({ where: { id: existing.id }, data: { ...data, images: { create: images } } });
          return existing.id;
        }
        const created = await tx.listing.create({
          data: { ...data, sourceId: l.sourceId, externalId: l.externalId, images: { create: images } },
        });
        return created.id;
      });
    },
    async log(entry) {
      await db.ingestLog.create({ data: entry });
    },
    async deactivateMissing(sourceId, seen) {
      const res = await db.listing.updateMany({
        where: { sourceId, active: true, externalId: { notIn: seen } },
        data: { active: false },
      });
      return res.count;
    },
  };
}
