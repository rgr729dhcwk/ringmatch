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

export type FetchOptions = {
  fetchImpl?: typeof fetch;
  log?: (m: string) => void;
  requestsPerSecond?: number;
  /** Also read each product's media file (/products/<handle>.js) for videos. */
  withVideos?: boolean;
};

type ShopifyMedia = {
  media_type?: string;
  preview_image?: { src?: string };
  sources?: { format?: string; mime_type?: string; url?: string; width?: number; height?: number }[];
};

/** Pick the mp4 closest to 720p (clear on a phone, not wasteful). */
export function pickVideos(media: ShopifyMedia[]): { url: string; posterUrl: string | null; width?: number; height?: number }[] {
  const out: { url: string; posterUrl: string | null; width?: number; height?: number }[] = [];
  for (const m of media) {
    if (m.media_type !== "video") continue;
    const mp4 = (m.sources ?? []).filter((s) => s.url && (s.format === "mp4" || s.mime_type === "video/mp4"));
    if (!mp4.length) continue;
    const best = mp4.sort((a, b) => Math.abs((a.height ?? 0) - 720) - Math.abs((b.height ?? 0) - 720))[0]!;
    const url = best.url!.startsWith("//") ? `https:${best.url}` : best.url!;
    const poster = m.preview_image?.src ? (m.preview_image.src.startsWith("//") ? `https:${m.preview_image.src}` : m.preview_image.src) : null;
    out.push({ url, posterUrl: poster, width: best.width, height: best.height });
  }
  return out.slice(0, 2);
}

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
      const raw = toRawListing(vendor, p);
      if (opts.withVideos) {
        const mediaPath = `/products/${p.handle}.js`;
        if (isAllowed(robots, USER_AGENT, mediaPath)) {
          await wait();
          try {
            const r = await f(`${vendor.origin}${mediaPath}`, { headers, redirect: "follow" });
            if (r.ok) raw.videos = pickVideos(((await r.json()) as { media?: ShopifyMedia[] }).media ?? []);
          } catch {
            /* media is optional */
          }
        }
      }
      out.push(raw);
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
