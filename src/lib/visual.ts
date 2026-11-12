import { z } from "zod";
import { ListingAttributesSchema, type ListingAttributes, type ValidatedImage } from "./listing";
import {
  BAND_PROFILES,
  BAND_STYLES,
  CENTER_STONES,
  METALS,
  PRONGS,
  RENDER_DEFAULTS,
  SETTINGS,
  SHAPES,
} from "./taxonomy";

/** Minimum longest side (px) for an image to count as a usable card visual. */
export const MIN_IMAGE_LONGEST_SIDE = 600;

/** Everything the procedural 3D renderer needs. All fields are always present. */
export const ProceduralParamsSchema = z.object({
  shape: z.enum(SHAPES),
  caratWeight: z.number().positive(),
  setting: z.enum(SETTINGS),
  prongs: z.enum(PRONGS),
  metal: z.enum(METALS),
  bandWidthMm: z.number().positive(),
  bandStyle: z.enum(BAND_STYLES),
  bandProfile: z.enum(BAND_PROFILES),
  centerStone: z.enum(CENTER_STONES),
});
export type ProceduralParams = z.infer<typeof ProceduralParamsSchema>;

export type ImageVisual = { kind: "image"; images: [ValidatedImage, ...ValidatedImage[]] };
export type ProceduralVisual = { kind: "procedural"; params: ProceduralParams };
/** A card's visual. Required — a card cannot exist without one. */
export type Visual = ImageVisual | ProceduralVisual;

export const PROCEDURAL_BADGE = "Style preview — illustrative render";

export function isUsableImage(img: Partial<ValidatedImage> | null | undefined): img is ValidatedImage {
  if (!img || typeof img.url !== "string" || img.url.length === 0) return false;
  const w = img.width ?? 0;
  const h = img.height ?? 0;
  return Math.max(w, h) >= MIN_IMAGE_LONGEST_SIDE;
}

/**
 * A procedural render is only meaningful if we know at least what the ring broadly looks like:
 * the stone shape or the setting style. Everything else gets a sensible default.
 */
export function canRenderProcedurally(attrs: Partial<ListingAttributes>): boolean {
  return Boolean(attrs.shape || attrs.setting);
}

export function proceduralParamsFrom(attrs: Partial<ListingAttributes>): ProceduralParams {
  const d = RENDER_DEFAULTS;
  return {
    shape: attrs.shape ?? d.shape,
    caratWeight: attrs.caratWeight ?? d.caratWeight,
    setting: attrs.setting ?? d.setting,
    prongs: attrs.prongs ?? d.prongs,
    metal: attrs.metal ?? d.metal,
    bandWidthMm: attrs.bandWidthMm ?? d.bandWidthMm,
    bandStyle: attrs.bandStyle ?? d.bandStyle,
    bandProfile: attrs.bandProfile ?? d.bandProfile,
    centerStone: attrs.centerStone ?? d.centerStone,
  };
}

/**
 * Decide what a listing shows. Validated images win; otherwise a procedural render from
 * attributes; otherwise null (the listing must not become a card).
 */
export function resolveVisual(input: {
  renderType?: string | null;
  images?: ReadonlyArray<Partial<ValidatedImage>> | null;
  attributes: Partial<ListingAttributes>;
}): Visual | null {
  const images = (input.images ?? []).filter(isUsableImage);
  if (images.length > 0) {
    return { kind: "image", images: images as [ValidatedImage, ...ValidatedImage[]] };
  }
  const attrs = ListingAttributesSchema.partial().safeParse(input.attributes);
  if (!attrs.success || !canRenderProcedurally(attrs.data)) return null;
  return { kind: "procedural", params: proceduralParamsFrom(attrs.data) };
}

/** Structural check used by tests and as a last line of defence before rendering. */
export function isValidVisual(v: unknown): v is Visual {
  if (!v || typeof v !== "object") return false;
  const vis = v as Visual;
  if (vis.kind === "image") return Array.isArray(vis.images) && vis.images.length > 0 && vis.images.every(isUsableImage);
  if (vis.kind === "procedural") return ProceduralParamsSchema.safeParse(vis.params).success;
  return false;
}
