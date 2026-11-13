import { z } from "zod";
import {
  ANY,
  BAND_PROFILES,
  BAND_STYLES,
  CENTER_STONES,
  CLARITIES,
  COLOR_GROUPS,
  CUTS,
  DEFAULT_STATED_PREFS,
  METALS,
  ORIGIN_PREFERENCES,
  PRONGS,
  SETTINGS,
  SHAPES,
  type ColorGroup,
  type StatedPrefs,
} from "./taxonomy";

const anyOr = <T extends z.ZodTypeAny>(t: T) => z.union([z.literal(ANY), t]).optional().transform((v) => v ?? ANY);
const list = <T extends [string, ...string[]]>(values: T) =>
  // An empty list means "no preference" too.
  anyOr(z.array(z.enum(values))).transform((v) => (Array.isArray(v) && v.length === 0 ? ANY : v));
const range = z
  .object({ min: z.number().nonnegative(), max: z.number().positive() })
  .refine((r) => r.max > r.min, "max must be greater than min");

const COLOR_GROUP_NAMES = Object.keys(COLOR_GROUPS) as [ColorGroup, ...ColorGroup[]];

/** Validates stated preferences (onboarding answers). Unknown/missing fields fall back to ANY. */
export const StatedPrefsSchema = z.object({
  shapes: list(SHAPES as unknown as [string, ...string[]]),
  cuts: list(CUTS as unknown as [string, ...string[]]),
  colorGroups: list(COLOR_GROUP_NAMES),
  clarities: list(CLARITIES as unknown as [string, ...string[]]),
  carat: anyOr(range),
  origin: anyOr(z.enum(ORIGIN_PREFERENCES)).transform((v) => (v === "No preference" ? ANY : v)),
  centerStones: list(CENTER_STONES as unknown as [string, ...string[]]),
  settings: list(SETTINGS as unknown as [string, ...string[]]),
  prongs: list(PRONGS as unknown as [string, ...string[]]),
  metals: list(METALS as unknown as [string, ...string[]]),
  bandWidthMm: anyOr(range),
  bandStyles: list(BAND_STYLES as unknown as [string, ...string[]]),
  bandProfiles: list(BAND_PROFILES as unknown as [string, ...string[]]),
  budget: anyOr(range),
});

/** Parse stored/submitted prefs; anything invalid becomes "show me everything". */
export function parseStatedPrefs(input: unknown): StatedPrefs {
  let raw = input;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...DEFAULT_STATED_PREFS };
  // Field by field, so one bad answer doesn't throw away the others.
  for (const [key, schema] of Object.entries(StatedPrefsSchema.shape)) {
    const r = (schema as z.ZodTypeAny).safeParse(obj[key]);
    out[key] = r.success ? r.data : ANY;
  }
  return out as StatedPrefs;
}

export function hasAnyStatedPref(p: StatedPrefs): boolean {
  return Object.values(p).some((v) => v !== ANY);
}
