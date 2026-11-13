import { describe, expect, it } from "vitest";
import { orderDeck } from "@/recs/deckOrder";
import { effectiveInteractions } from "@/recs/preferenceVector";
import { ACTION_WEIGHTS } from "@/recs/weights";

describe("recs (Milestone 1 stubs)", () => {
  it("orderDeck is a stable permutation that avoids back-to-back shapes", () => {
    const items = Array.from({ length: 24 }, (_, i) => ({ id: `l${i}`, shape: ["Round", "Oval", "Pear"][i % 3] }));
    const a = orderDeck(items, "u1");
    expect(orderDeck(items, "u1")).toEqual(a);
    expect(new Set(a.map((x) => x.id)).size).toBe(24);
    for (let i = 1; i < a.length; i++) expect(a[i]!.shape).not.toBe(a[i - 1]!.shape);
  });

  it("undo cancels the interaction it points at", () => {
    const ev = [
      { id: "1", action: "like", undoesId: null },
      { id: "2", action: "love", undoesId: null },
      { id: "3", action: "undo", undoesId: "2" },
    ];
    expect(effectiveInteractions(ev).map((e) => e.id)).toEqual(["1"]);
  });

  it("weights: hard no −2, nope −1, like +1, revisit +1.25, love +2", () => {
    expect(ACTION_WEIGHTS).toEqual({ strong_dislike: -2, dislike: -1, like: 1, revisit: 1.25, love: 2 });
  });
});
