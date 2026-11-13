import { parseStatedPrefs } from "@/lib/prefs";
import type { StatedPrefs } from "@/lib/taxonomy";
import { computePreferenceVector, type InteractionEvent, type PreferenceVector } from "@/recs/preferenceVector";
import { DEFAULT_EXPLORE_RATE } from "@/recs/weights";
import { tasteSummary, type TasteSummary } from "@/recs/whyLine";
import { db } from "./db";

export type UserSignals = {
  prefs: StatedPrefs;
  exploreRate: number;
  onboarded: boolean;
  vector: PreferenceVector;
  interactionCount: number;
  events: { id: string; action: string; undoesId: string | null; listingId: string }[];
};

/** Everything the recommender needs about a user. Also refreshes the PreferenceVector cache. */
export async function loadSignals(userId: string): Promise<UserSignals> {
  const [profile, rows] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.interaction.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        listing: {
          select: {
            shape: true, metal: true, setting: true, prongs: true, centerStone: true, origin: true, color: true,
            clarity: true, caratWeight: true, price: true, bandStyle: true, bandProfile: true,
          },
        },
      },
    }),
  ]);
  const events: InteractionEvent[] = rows.map((r) => ({
    id: r.id,
    action: r.action as InteractionEvent["action"],
    undoesId: r.undoesId,
    createdAt: r.createdAt,
    attributes: r.listing,
  }));
  const vector = computePreferenceVector(events);
  await db.preferenceVector.upsert({
    where: { userId },
    create: { userId, vector: JSON.stringify(vector), interactionCount: rows.length, computedAt: new Date() },
    update: { vector: JSON.stringify(vector), interactionCount: rows.length, computedAt: new Date() },
  });
  return {
    prefs: parseStatedPrefs(profile?.statedPrefs),
    exploreRate: profile?.exploreRate ?? DEFAULT_EXPLORE_RATE,
    onboarded: Boolean(profile?.onboardedAt),
    vector,
    interactionCount: rows.length,
    events: rows.map((r) => ({ id: r.id, action: r.action, undoesId: r.undoesId, listingId: r.listingId })),
  };
}

export async function getTaste(userId: string): Promise<TasteSummary & { prefs: StatedPrefs }> {
  const s = await loadSignals(userId);
  return { ...tasteSummary(s.vector, s.events), prefs: s.prefs };
}
