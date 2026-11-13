/**
 * Turns a listing's attributes into taste "features" like "shape:Oval" or "metal:Rose Gold".
 * Pure — no DB or React.
 */
import { budgetBandOf, caratBandOf, colorGroupOf, COLORS, type Color } from "@/lib/taxonomy";

export type RecAttributes = {
  shape: string | null;
  metal: string | null;
  setting: string | null;
  prongs: string | null;
  centerStone: string | null;
  origin: string | null;
  color: string | null;
  clarity: string | null;
  caratWeight: number | null;
  price: number | null;
  bandStyle: string | null;
  bandProfile: string | null;
};

export const DIMENSIONS = [
  "shape",
  "setting",
  "metal",
  "centerStone",
  "origin",
  "carat",
  "budget",
  "prongs",
  "colorGroup",
  "clarity",
  "bandStyle",
  "bandProfile",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** How much each dimension matters when scoring. Shape and setting drive taste the most. */
export const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  shape: 1,
  setting: 1,
  metal: 0.9,
  centerStone: 0.8,
  carat: 0.6,
  origin: 0.5,
  budget: 0.4,
  prongs: 0.4,
  colorGroup: 0.3,
  bandStyle: 0.3,
  clarity: 0.2,
  bandProfile: 0.2,
};

export type Feature = `${Dimension}:${string}`;
export const featureKey = (d: Dimension, v: string): Feature => `${d}:${v}`;
export function splitFeature(f: string): [Dimension, string] {
  const i = f.indexOf(":");
  return [f.slice(0, i) as Dimension, f.slice(i + 1)];
}

export function featuresOf(a: RecAttributes): Feature[] {
  const out: Feature[] = [];
  const add = (d: Dimension, v: string | null | undefined) => {
    if (v) out.push(featureKey(d, v));
  };
  add("shape", a.shape);
  add("setting", a.setting);
  add("metal", a.metal);
  add("centerStone", a.centerStone);
  add("origin", a.origin);
  add("carat", caratBandOf(a.caratWeight));
  add("budget", budgetBandOf(a.price));
  add("prongs", a.prongs);
  add("colorGroup", a.color && (COLORS as readonly string[]).includes(a.color) ? colorGroupOf(a.color as Color) : null);
  add("clarity", a.clarity);
  add("bandStyle", a.bandStyle);
  add("bandProfile", a.bandProfile);
  return out;
}
