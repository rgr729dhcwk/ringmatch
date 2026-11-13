import { ListingAttributesSchema } from "./listing";
import { PRONG_LABELS, type ImageKind, type Prong } from "./taxonomy";
import { isValidVisual, resolveVisual, type Visual } from "./visual";

/** The shape of a listing row as loaded from the DB (structural; no Prisma import here). */
export type ListingRow = {
  id: string;
  title: string;
  retailer: string;
  attribution: string;
  sourceUrl: string | null;
  isSample: boolean;
  price: number | null;
  currency: string;
  priceIsEstimate: boolean;
  renderType: string;
  shape: string | null;
  cut: string | null;
  color: string | null;
  clarity: string | null;
  caratWeight: number | null;
  origin: string | null;
  centerStone: string | null;
  setting: string | null;
  prongs: string | null;
  metal: string | null;
  bandWidthMm: number | null;
  bandStyle: string | null;
  bandProfile: string | null;
  images: { url: string; kind: string; width: number; height: number; position: number }[];
};

export type CardSpec = { label: string; value: string };

export type Card = {
  id: string;
  title: string;
  retailer: string;
  attribution: string;
  /** Link to the original listing. Null for sample cards. */
  sourceUrl: string | null;
  isSample: boolean;
  price: { amount: number; currency: string; isEstimate: boolean } | null;
  specs: CardSpec[];
  /** REQUIRED. A card without a visual cannot be constructed. */
  visual: Visual;
  /** "Why you're seeing this" (set by the recommender). */
  why?: string;
  /** True when this card is an exploration pick outside the user's current taste. */
  explore?: boolean;
};

export function formatPrice(p: NonNullable<Card["price"]>): string {
  const s = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: p.currency,
    maximumFractionDigits: 0,
  }).format(p.amount);
  return p.isEstimate ? `${s} est.` : s;
}

function attributesOf(row: ListingRow) {
  // Unknown/invalid values are dropped field by field rather than discarding the listing.
  const out: Record<string, unknown> = {};
  const shape = ListingAttributesSchema.shape;
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    const parsed = shape[key].safeParse(row[key]);
    out[key] = parsed.success ? parsed.data : null;
  }
  return out as Partial<import("./listing").ListingAttributes>;
}

/** Convert a DB row to a Card, or null if no visual can be guaranteed (the row is then skipped). */
export function toCard(row: ListingRow): Card | null {
  const attrs = attributesOf(row);
  const images = [...row.images]
    .sort((a, b) => a.position - b.position)
    .map((i) => ({ url: i.url, kind: i.kind as ImageKind, width: i.width, height: i.height }));
  const visual = resolveVisual({ renderType: row.renderType, images, attributes: attrs });
  if (!visual || !isValidVisual(visual)) return null;

  const specs: CardSpec[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) specs.push({ label, value });
  };
  add("Shape", attrs.shape);
  add("Carat", attrs.caratWeight != null ? `${attrs.caratWeight.toFixed(2)} ct` : null);
  add("Color", attrs.color);
  add("Clarity", attrs.clarity);
  add("Cut", attrs.cut);
  add("Metal", attrs.metal);
  add("Setting", attrs.setting);
  add("Prongs", attrs.prongs ? PRONG_LABELS[attrs.prongs as Prong] : null);
  add("Stone", attrs.centerStone && attrs.origin ? `${attrs.origin} ${attrs.centerStone.toLowerCase()}` : attrs.centerStone);
  add("Band", attrs.bandWidthMm != null ? `${attrs.bandWidthMm} mm ${[attrs.bandProfile, attrs.bandStyle].filter(Boolean).join(" ").toLowerCase()}`.trim() : null);

  return {
    id: row.id,
    title: row.title,
    retailer: row.retailer,
    attribution: row.attribution,
    sourceUrl: row.isSample ? null : row.sourceUrl,
    isSample: row.isSample,
    price: row.price != null ? { amount: row.price, currency: row.currency, isEstimate: row.priceIsEstimate } : null,
    specs,
    visual,
  };
}

/** Build a deck from rows: only cards with a guaranteed visual survive. */
export function buildDeck(rows: ListingRow[]): Card[] {
  const deck: Card[] = [];
  for (const row of rows) {
    const card = toCard(row);
    if (card) deck.push(card);
  }
  return deck;
}
