/**
 * Re-imports retailer listings into seed/vendors/<id>.json.
 *   npm run vendors:refresh            (all vendors)
 *   npm run vendors:refresh -- ringconcierge
 * Reads each store's public product feed (robots.txt respected), extracts ring details, checks every
 * photo (HTTP 200, image/*, ≥600px) and keeps only listings that get a guaranteed visual.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createImageChecker, createVideoChecker } from "../src/sources/imageCheck";
import { createRateLimiter, processListing } from "../src/sources/ingest";
import { fetchVendorListings, USER_AGENT } from "../src/sources/shopify";
import { getSourceConfig } from "../src/sources/sources.config";
import { snapshotFile, vendorNormalize } from "../src/sources/vendor.adapter";
import { VENDORS } from "../src/sources/vendors";

async function main() {
  const only = process.argv.slice(2);
  for (const vendor of VENDORS.filter((v) => !only.length || only.includes(v.id))) {
    const cfg = { ...getSourceConfig(vendor.id), imagePolicy: { ...getSourceConfig(vendor.id).imagePolicy, trustValidatedWithinDays: 0 } };
    const raws = await fetchVendorListings(vendor, { log: console.log, withVideos: true });
    const politeFetch: typeof fetch = (url, init) => fetch(url, { ...init, headers: { ...(init?.headers ?? {}), "user-agent": USER_AGENT } });
    const checker = createImageChecker({ minLongestSide: cfg.imagePolicy.minLongestSide, fetchImpl: politeFetch });
    const videoChecker = createVideoChecker({ fetchImpl: politeFetch });
    const throttle = createRateLimiter(3);
    const now = new Date().toISOString();
    const listings: Record<string, unknown>[] = [];
    const counts = { accepted: 0, fell_back_procedural: 0, rejected: 0 };
    for (const raw of raws) {
      const p = await processListing(raw, { normalize: vendorNormalize(vendor) }, cfg, checker, throttle, videoChecker);
      counts[p.outcome]++;
      if (p.outcome === "rejected") {
        console.log(`  rejected ${raw.title}: ${p.reason}`);
        continue;
      }
      for (const f of p.imageFailures) console.log(`  photo skipped (${f.reason}): ${f.url}`);
      const { sourceId: _s, retailer: _r, attribution: _a, isSample: _i, priceIsEstimate: _p, images: _img, videos: _v, ...rest } = p.listing;
      listings.push({
        ...rest,
        images: p.images.map((im) => ({ ...im, validatedAt: now })),
        videos: p.videos.map((v) => ({
          url: v.url,
          ...(v.posterUrl ? { posterUrl: v.posterUrl } : {}),
          ...(v.width ? { width: v.width } : {}),
          ...(v.height ? { height: v.height } : {}),
          validatedAt: now,
        })),
      });
    }
    const file = snapshotFile(vendor.id);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      JSON.stringify({ $comment: `Imported from ${vendor.origin}/products.json by scripts/refresh-vendors.ts. Do not edit by hand.`, vendor: vendor.name, fetchedAt: now, listings }, null, 2) + "\n",
    );
    const known = (k: string) => listings.filter((l) => l[k] != null).length;
    console.log(
      `[${vendor.id}] saved ${listings.length} (photos ok ${counts.accepted}, 3D only ${counts.fell_back_procedural}, rejected ${counts.rejected}). ` +
        `Details found — shape ${known("shape")}, setting ${known("setting")}, metal ${known("metal")}, carat ${known("caratWeight")}, ` +
        `colour ${known("color")}, clarity ${known("clarity")}, price ${known("price")}, ` +
        `videos ${listings.filter((l) => (l.videos as unknown[]).length > 0).length}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
