import { z } from "zod";
import {
  BAND_PROFILES,
  BAND_STYLES,
  BAND_WIDTH_BOUNDS,
  CARAT_BOUNDS,
  CENTER_STONES,
  CLARITIES,
  COLORS,
  CURRENCIES,
  CUTS,
  IMAGE_KINDS,
  METALS,
  ORIGINS,
  PRONGS,
  RENDER_TYPES,
  SETTINGS,
  SHAPES,
} from "./taxonomy";

/** Nullable + optional: unknown attributes are simply absent. */
const opt = <T extends z.ZodTypeAny>(t: T) => t.nullish().transform((v) => v ?? null);

export const ListingImageInputSchema = z.object({
  url: z.string().min(1),
  kind: z.enum(IMAGE_KINDS).default("photo"),
  /** Set when the image was already checked by an earlier import (snapshot sources). */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  validatedAt: z.string().datetime().optional(),
});
export type ListingImageInput = z.infer<typeof ListingImageInputSchema>;

/** A product video (e.g. a turntable spin). Optional extra media; the required visual is still a photo or 3D render. */
export const ListingVideoInputSchema = z.object({
  url: z.string().url(),
  posterUrl: z.string().url().nullish(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  validatedAt: z.string().datetime().optional(),
});
export type ListingVideoInput = z.infer<typeof ListingVideoInputSchema>;
export type ValidatedVideo = { url: string; posterUrl: string | null; width: number | null; height: number | null };

export const ListingAttributesSchema = z.object({
  shape: opt(z.enum(SHAPES)),
  cut: opt(z.enum(CUTS)),
  color: opt(z.enum(COLORS)),
  clarity: opt(z.enum(CLARITIES)),
  caratWeight: opt(z.number().min(CARAT_BOUNDS.min).max(CARAT_BOUNDS.max)),
  origin: opt(z.enum(ORIGINS)),
  centerStone: opt(z.enum(CENTER_STONES)),
  setting: opt(z.enum(SETTINGS)),
  prongs: opt(z.enum(PRONGS)),
  metal: opt(z.enum(METALS)),
  bandWidthMm: opt(z.number().min(BAND_WIDTH_BOUNDS.min).max(BAND_WIDTH_BOUNDS.max)),
  bandStyle: opt(z.enum(BAND_STYLES)),
  bandProfile: opt(z.enum(BAND_PROFILES)),
});
export type ListingAttributes = z.infer<typeof ListingAttributesSchema>;

/** A normalized listing, as every source adapter must output it (before image validation). */
export const NormalizedListingSchema = ListingAttributesSchema.extend({
  sourceId: z.string().min(1),
  externalId: opt(z.string().min(1)),
  sourceUrl: opt(z.string().url()),
  retailer: z.string().min(1),
  attribution: z.string().min(1),
  title: z.string().min(1),
  price: opt(z.number().nonnegative()),
  currency: z.enum(CURRENCIES).default("USD"),
  priceIsEstimate: z.boolean().default(false),
  isSample: z.boolean().default(false),
  images: z.array(ListingImageInputSchema).default([]),
  videos: z.array(ListingVideoInputSchema).default([]),
});
export type NormalizedListing = z.infer<typeof NormalizedListingSchema>;

export const RenderTypeSchema = z.enum(RENDER_TYPES);

/** A validated image as stored in the DB. */
export type ValidatedImage = {
  url: string;
  kind: (typeof IMAGE_KINDS)[number];
  width: number;
  height: number;
};
