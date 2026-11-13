import { describe, expect, it } from "vitest";
import { computeShortlist, moveItem, validateLayout, type SavedSwipe } from "@/lib/shortlist";

const at = (s: number) => new Date(1_700_000_000_000 + s * 1000);
const sw = (listingId: string, action: SavedSwipe["action"], t: number): SavedSwipe => ({ listingId, action, createdAt: at(t) });

describe("computeShortlist", () => {
  it("includes loved (Top picks) and saved-for-later (Maybe) rings, not likes or passes", () => {
    const s = computeShortlist([sw("a", "love", 1), sw("b", "revisit", 2), sw("c", "like", 3), sw("d", "dislike", 4)], []);
    expect(s.top.map((e) => e.listingId)).toEqual(["a"]);
    expect(s.maybe.map((e) => e.listingId)).toEqual(["b"]);
    expect(s.strong).toEqual([]);
    expect(s.top[0]!.isNew).toBe(true);
  });

  it("the latest swipe on a ring wins", () => {
    const s = computeShortlist([sw("a", "love", 1), sw("a", "dislike", 2)], []);
    expect(s.top).toEqual([]);
  });

  it("keeps stored tiers and order, and adds newcomers at the end of their tier", () => {
    const rows = [
      { listingId: "b", tier: "top", rank: 0, removedAt: null },
      { listingId: "a", tier: "top", rank: 1, removedAt: null },
      { listingId: "c", tier: "strong", rank: 0, removedAt: null },
    ];
    const s = computeShortlist([sw("a", "love", 1), sw("b", "love", 2), sw("c", "revisit", 3), sw("d", "love", 4)], rows);
    expect(s.top.map((e) => e.listingId)).toEqual(["b", "a", "d"]);
    expect(s.top.map((e) => e.rank)).toEqual([0, 1, 2]);
    expect(s.strong.map((e) => e.listingId)).toEqual(["c"]);
  });

  it("removed rings stay off unless loved or saved again after removal", () => {
    const rows = [{ listingId: "a", tier: "top", rank: 0, removedAt: at(5) }];
    expect(computeShortlist([sw("a", "love", 1)], rows).top).toEqual([]);
    expect(computeShortlist([sw("a", "love", 9)], rows).top.map((e) => e.listingId)).toEqual(["a"]);
  });
});

describe("layouts", () => {
  const current = computeShortlist([sw("a", "love", 1), sw("b", "love", 2), sw("c", "revisit", 3)], []);

  it("accepts a pure rearrangement", () => {
    expect(validateLayout({ top: ["b"], strong: ["c", "a"], maybe: [] }, current)).toEqual({ top: ["b"], strong: ["c", "a"], maybe: [] });
  });

  it("rejects missing, extra, duplicated or foreign ids and unknown tiers", () => {
    expect(validateLayout({ top: ["a", "b"], strong: [], maybe: [] }, current)).toBeNull();
    expect(validateLayout({ top: ["a", "b", "c", "x"], strong: [], maybe: [] }, current)).toBeNull();
    expect(validateLayout({ top: ["a", "a", "b"], strong: [], maybe: ["c"] }, current)).toBeNull();
    expect(validateLayout({ top: ["a", "b"], strong: [], maybe: ["c"], secret: [] }, current)).toBeNull();
    expect(validateLayout("nope", current)).toBeNull();
  });

  it("moveItem moves between tiers and positions", () => {
    const l = { top: ["a", "b"], strong: [], maybe: ["c"] };
    expect(moveItem(l, "a", "maybe")).toEqual({ top: ["b"], strong: [], maybe: ["c", "a"] });
    expect(moveItem(l, "c", "top", 0)).toEqual({ top: ["c", "a", "b"], strong: [], maybe: [] });
    expect(moveItem(l, "b", "top", 0)).toEqual({ top: ["b", "a"], strong: [], maybe: ["c"] });
  });
});
