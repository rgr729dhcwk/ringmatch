/** "Why you're seeing this" lines and the taste summary. Pure. */
import { splitFeature, type Dimension, type Feature } from "./features";
import { joinPhrases, phraseFor } from "./labels";
import { effectiveInteractions, topFeatures, type PreferenceVector } from "./preferenceVector";
import type { Contribution } from "./score";

export const WHY_EXPLORE = "Something different — helps RingMatch learn your taste";
export const WHY_FRESH = "A fresh style to start you off";

/** Partner mode: whose taste each learned feature came from. */
export type Attribution = { mine: PreferenceVector; partner: PreferenceVector; partnerName: string };

/** Explains a card from its score contributions. */
export function whyLine(contributions: Contribution[], explore: boolean, attribution?: Attribution): string {
  if (explore) return WHY_EXPLORE;
  const positive = contributions.filter((c) => c.value > 0.12);
  const learned = dedupe(positive.filter((c) => c.source === "learned"));
  if (learned.length && attribution) {
    const who = (f: string) => {
      const m = (attribution.mine[f] ?? 0) > 0;
      const p = (attribution.partner[f] ?? 0) > 0;
      return m && p ? "both" : p ? "partner" : m ? "me" : null;
    };
    const lead = learned.map((c) => ({ c, w: who(c.feature) })).filter((x) => x.w);
    if (lead.length) {
      const kind = lead[0]!.w!;
      const phrases = joinPhrases(lead.filter((x) => x.w === kind).slice(0, 2).map((x) => phraseFor(x.c.feature)));
      if (kind === "both") return `You and ${attribution.partnerName} both liked ${phrases}`;
      if (kind === "partner") return `Because ${attribution.partnerName} liked ${phrases}`;
      return `Because you liked ${phrases}`;
    }
  }
  if (learned.length) return `Because you liked ${joinPhrases(learned.slice(0, 2).map((c) => phraseFor(c.feature)))}`;
  const stated = dedupe(positive.filter((c) => c.source === "stated"));
  if (stated.length) return `Matches what you told us: ${joinPhrases(stated.slice(0, 2).map((c) => phraseFor(c.feature)))}`;
  return WHY_FRESH;
}

function dedupe(cs: Contribution[]): Contribution[] {
  const best = new Map<string, Contribution>();
  for (const c of cs) {
    const prev = best.get(c.feature);
    if (!prev || c.value > prev.value) best.set(c.feature, c);
  }
  return [...best.values()].sort((a, b) => b.value - a.value);
}

export const MIN_SWIPES_FOR_SUMMARY = 5;

export type TasteSummary = {
  ready: boolean;
  swipes: number;
  counts: { love: number; like: number; revisit: number; dislike: number; strong_dislike: number };
  text: string;
  likes: { dimension: Dimension; phrase: string; strength: number }[];
  dislikes: { dimension: Dimension; phrase: string; strength: number }[];
};

const SUMMARY_DIMS: Dimension[] = ["shape", "metal", "setting", "centerStone", "carat", "origin"];

export function tasteSummary(
  vector: PreferenceVector,
  interactions: { id: string; action: string; undoesId: string | null }[],
): TasteSummary {
  const eff = effectiveInteractions(interactions);
  const counts = { love: 0, like: 0, revisit: 0, dislike: 0, strong_dislike: 0 };
  for (const e of eff) if (e.action in counts) counts[e.action as keyof typeof counts]++;
  const swipes = eff.length;
  const base = { swipes, counts, likes: [], dislikes: [] };
  if (swipes < MIN_SWIPES_FOR_SUMMARY) {
    const left = MIN_SWIPES_FOR_SUMMARY - swipes;
    return { ...base, ready: false, text: `Swipe ${left} more ring${left === 1 ? "" : "s"} to see your taste.` };
  }

  const pick = (sign: 1 | -1, minAbs: number, perDim: number) => {
    const out: { dimension: Dimension; phrase: string; strength: number }[] = [];
    for (const d of SUMMARY_DIMS) {
      const inDim = topFeatures(filterDim(vector, d), perDim, sign).filter(([, x]) => Math.abs(x) >= minAbs);
      for (const [f, x] of inDim) out.push({ dimension: d, phrase: phraseFor(f), strength: Math.abs(x) });
    }
    return out.sort((a, b) => b.strength - a.strength);
  };
  const likes = pick(1, 1, 2);
  const dislikes = pick(-1, 1.5, 1).slice(0, 3);

  const parts: string[] = [];
  if (likes.length) parts.push(`You lean toward ${joinPhrases(likes.slice(0, 4).map((l) => l.phrase))}.`);
  else parts.push("No strong favourites yet — your taste is wide open.");
  if (dislikes.length) parts.push(`Less keen on ${joinPhrases(dislikes.map((l) => l.phrase))}.`);
  return { ...base, ready: true, likes, dislikes, text: parts.join(" ") };
}

function filterDim(v: PreferenceVector, d: Dimension): PreferenceVector {
  const out: PreferenceVector = {};
  for (const [k, x] of Object.entries(v)) if (splitFeature(k as Feature)[0] === d) out[k] = x;
  return out;
}
