/**
 * Reads a Shopify store's public product feed (/products.json) politely:
 * checks robots.txt first, identifies itself, and waits between requests.
 */
import { extractAttributes } from "./extract";
import { createRateLimiter } from "./ingest";
import { isAllowed, parseRobots } from "./robots";
import type { RawListing } from "./types";
import { isEngagementRing, tagsOf, type ShopifyProduct, type Vendor } from "./vendors";

export const USER_AGENT = "RingMatchBot/0.1 (personal proof of concept; every listing links back to the retailer)";

export type FetchOptions = { fetchImpl?: typeof fetch; log?: (m: string) => void; requestsPerSecond?: number };

export async function fetchVendorListings(vendor: Vendor, opts: FetchOptions = {}): Promise<RawListing[]> {
  const f = opts.fetchImpl ?? fetch;
  const log = opts.log ?? (() => {});
  const wait = createRateLimiter(opts.requestsPerSecond ?? 1);
  const headers = { "user-agent": USER_AGENT, accept: "application/json" };

  await wait();
  const robotsRes = await f(`${vendor.origin}/robots.txt`, { headers: { "user-agent": USER_AGENT } });
  const robots = parseRobots(robotsRes.ok ? await robotsRes.text() : "");

  const out: RawListing[] = [];
  for (let page = 1; page <= vendor.maxPages && out.length < vendor.maxListings; page++) {
    const path = `/products.json?limit=250&page=${page}`;
    if (!isAllowed(robots, USER_AGENT, path)) {
      log(`[${vendor.id}] robots.txt disallows ${path} — stopping`);
      break;
    }
    await wait();
    const res = await f(`${vendor.origin}${path}`, { headers });
    if (!res.ok) {
      log(`[${vendor.id}] ${path} → HTTP ${res.status} — stopping`);
      break;
    }
    const products = ((await res.json()) as { products?: ShopifyProduct[] }).products ?? [];
    if (!products.length) break;
    for (const p of products) {
      if (out.length >= vendor.maxListings) break;
      if (!isEngagementRing(p)) continue;
      out.push(toRawListing(vendor, p));
    }
    log(`[${vendor.id}] page ${page}: ${products.length} products, ${out.length} engagement rings so far`);
  }
  return out;
}

export function toRawListing(vendor: Vendor, p: ShopifyProduct): RawListing {
  const prices = p.variants.filter((v) => v.available !== false).map((v) => Number(v.price)).filter((n) => n > 0);
  const attrs = extractAttributes({ title: p.title, tags: tagsOf(p), productType: p.product_type, body: p.body_html });
  return {
    externalId: String(p.id),
    title: p.title.trim(),
    sourceUrl: `${vendor.origin}/products/${p.handle}`,
    price: prices.length ? Math.min(...prices) : null,
    currency: "USD",
    ...attrs,
    images: p.images.slice(0, 6).map((im) => ({ url: im.src, kind: "photo" })),
  };
}
