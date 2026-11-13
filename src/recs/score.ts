/**
 * Scores a ring for a user: stated preferences (onboarding) + learned taste (swipes).
 * Returns per-feature contributions so why-lines can explain the score. Pure.
 */
import { ANY, type StatedPrefs } from "@/lib/taxonomy";
import { DIMENSION_WEIGHTS, featuresOf, splitFeature, type Dimension, type Feature, type RecAttributes } from "./features";
import type { PreferenceVector } from "./preferenceVector";

export type Contribution = { feature: Feature; source: "learned" | "stated"; value: number };
export type Scored = { score: number; contributions: Contribution[] };

/** Learned values are squashed so one dimension can't dominate forever. */
const LEARNED_SCALE = 3;
const STATED_MATCH = 0.8;
const STATED_MISS = -0.4;
const OVER_BUDGET = -2.5;

function statedListFor(p: StatedPrefs, d: Dimension): readonly string[] | null {
  const pick = (v: readonly string[] | typeof ANY) => (v === ANY ? null : v);
  switch (d) {
    case "shape":
      return pick(p.shapes);
    case "setting":
      return pick(p.settings);
    case "metal":
      return pick(p.metals);
    case "centerStone":
      return pick(p.centerStones);
    case "prongs":
      return pick(p.prongs);
    case "colorGroup":
      return pick(p.colorGroups);
    case "clarity":
      return pick(p.clarities);
    case "bandStyle":
      return pick(p.bandStyles);
    case "bandProfile":
      return pick(p.bandProfiles);
    case "origin":
      return p.origin === ANY ? null : [p.origin];
    default:
      return null;
  }
}

export function scoreItem(attrs: RecAttributes, prefs: StatedPrefs, vector: PreferenceVector): Scored {
  const contributions: Contribution[] = [];
  const feats = featuresOf(attrs);

  for (const f of feats) {
    const [d] = splitFeature(f);
    const learned = vector[f];
    if (learned) {
      contributions.push({ feature: f, source: "learned", value: DIMENSION_WEIGHTS[d] * Math.tanh(learned / LEARNED_SCALE) });
    }
    const stated = statedListFor(prefs, d);
    if (stated) {
      const value = splitFeature(f)[1];
      contributions.push({
        feature: f,
        source: "stated",
        value: DIMENSION_WEIGHTS[d] * (stated.includes(value) ? STATED_MATCH : STATED_MISS),
      });
    }
  }

  // Ranges: carat and budget.
  if (prefs.carat !== ANY && attrs.caratWeight != null) {
    const inRange = attrs.caratWeight >= prefs.carat.min && attrs.caratWeight <= prefs.carat.max;
    const band = feats.find((f) => f.startsWith("carat:"));
    if (band) {
      contributions.push({
        feature: band,
        source: "stated",
        value: DIMENSION_WEIGHTS.carat * (inRange ? STATED_MATCH : STATED_MISS),
      });
    }
  }
  if (prefs.budget !== ANY && attrs.price != null) {
    const band = feats.find((f) => f.startsWith("budget:"));
    if (band) {
      const over = attrs.price > prefs.budget.max * 1.15;
      const within = attrs.price >= prefs.budget.min * 0.85 && attrs.price <= prefs.budget.max * 1.15;
      contributions.push({
        feature: band,
        source: "stated",
        value: over ? OVER_BUDGET : within ? DIMENSION_WEIGHTS.budget * STATED_MATCH : 0,
      });
    }
  }

  const score = contributions.reduce((s, c) => s + c.value, 0);
  return { score, contributions };
}
