/** Ingest every enabled source into the DB. Run with: npm run db:seed */
import { PrismaClient } from "@prisma/client";
import { createImageChecker } from "../src/sources/imageCheck";
import { ingestSource } from "../src/sources/ingest";
import { createPrismaIngestStore } from "../src/sources/prismaStore";
import { getEnabledAdapters } from "../src/sources/registry";
import { getSourceConfig } from "../src/sources/sources.config";

async function main() {
  const db = new PrismaClient();
  const store = createPrismaIngestStore(db);
  try {
    for (const adapter of getEnabledAdapters()) {
      const cfg = getSourceConfig(adapter.id);
      const checker = createImageChecker({
        minLongestSide: cfg.imagePolicy.minLongestSide,
        offline: process.env.RINGMATCH_OFFLINE === "1",
      });
      const s = await ingestSource(adapter, cfg, checker, store, { log: (m) => console.log(m) });
      console.log(
        `[${s.sourceId}] accepted with images: ${s.accepted}, procedural fallback: ${s.fellBack}, rejected: ${s.rejected}, deactivated: ${s.deactivated}`,
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
