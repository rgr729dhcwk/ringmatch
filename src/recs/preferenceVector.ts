/**
 * STUB (Milestone 2): builds a taste vector from interactions.
 * Each attribute value (e.g. "shape:Oval") accumulates ACTION_WEIGHTS[action] * recencyDecay.
 * Undo rows cancel the row they point at.
 */
import type { InteractionAction } from "@/lib/taxonomy";

export type InteractionEvent = {
  id: string;
  action: InteractionAction;
  undoesId: string | null;
  attributes: Record<string, string | number | null>;
  createdAt: Date;
};

export type PreferenceVector = Record<string, number>;

/** Returns the interactions still in effect (undone rows and undo rows removed). */
export function effectiveInteractions<T extends { id: string; action: string; undoesId: string | null }>(events: T[]): T[] {
  const undone = new Set(events.filter((e) => e.action === "undo" && e.undoesId).map((e) => e.undoesId!));
  return events.filter((e) => e.action !== "undo" && !undone.has(e.id));
}

export function computePreferenceVector(_events: InteractionEvent[]): PreferenceVector {
  return {}; // Milestone 2
}
