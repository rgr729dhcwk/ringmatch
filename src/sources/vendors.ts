/**
 * Retailers whose public product feeds RingMatch imports (proof of concept).
 * Each card credits the retailer and links to the original listing — the goal is to send shoppers
 * to these shops, not to replace them. Add a vendor here, then run `npm run vendors:refresh`.
 */
export type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  body_html?: string | null;
  product_type?: string | null;
  tags?: string[] | string;
  variants: { price: string; available?: boolean }[];
  options?: { name: string; values?: string[] }[];
  images: { src: string; width?: number; height?: number }[];
};

export type Vendor = {
  id: string;
  name: string;
  origin: string;
  platform: "shopify";
  /** How many listings to keep in the snapshot. */
  maxListings: number;
  /** Max feed pages (250 products each) to read. */
  maxPages: number;
  description: string;
};

export const VENDORS: Vendor[] = [
  {
    id: "ringconcierge",
    name: "Ring Concierge",
    origin: "https://www.ringconcierge.com",
    platform: "shopify",
    maxListings: 25,
    maxPages: 6,
    description: "Modern engagement rings, many lab-grown",
  },
  {
    id: "trumpetandhorn",
    name: "Trumpet & Horn",
    origin: "https://www.trumpetandhorn.com",
    platform: "shopify",
    maxListings: 32,
    maxPages: 2,
    description: "Vintage and antique engagement rings",
  },
];

export const tagsOf = (p: ShopifyProduct): string[] =>
  Array.isArray(p.tags) ? p.tags : typeof p.tags === "string" ? p.tags.split(",").map((t) => t.trim()) : [];

/** Engagement rings only: no loose stones, bands or other jewellery; must be available to buy. */
export function isEngagementRing(p: ShopifyProduct): boolean {
  const type = (p.product_type ?? "").toLowerCase();
  const text = `${p.title} | ${type} | ${tagsOf(p).join(" | ")}`.toLowerCase();
  if (!/engagement|bridal/.test(text)) return false;
  if (/^(diamond|diamonds|loose|vault exclusive|gemstone)s?$/.test(type)) return false; // loose stones
  if (/#\d{5,}/.test(p.title)) return false; // "Round #826657226" style loose-diamond listings
  if (/(wedding band|eternity band|stacking band|earring|necklace|pendant|bracelet|\bstuds?\b|gift card)/.test(`${p.title} ${type}`.toLowerCase()))
    return false;
  if (!p.images?.length) return false;
  // "Choose your own stone" settings (an option to pick the diamond shape): the price and details
  // describe the setting only, which would be misleading next to complete rings. Skipped for now.
  if ((p.options ?? []).some((o) => /(diamond|stone|center|centre)\s*(shape|cut)|^shape$/i.test(o.name))) return false;
  return p.variants.some((v) => v.available !== false);
}
