import { describe, expect, it } from "vitest";
import { parseStatedPrefs } from "@/lib/prefs";
import { ANY, DEFAULT_STATED_PREFS, type StatedPrefs } from "@/lib/taxonomy";
import { mixExploration } from "@/recs/explore";
import { featuresOf, type RecAttributes } from "@/recs/features";
import { computePreferenceVector, recencyDecay, type InteractionEvent } from "@/recs/preferenceVector";
import { rankDeck } from "@/recs/rank";
import { scoreItem } from "@/recs/score";
import { tasteSummary, whyLine, WHY_EXPLORE, WHY_FRESH } from "@/recs/whyLine";

const attrs = (o: Partial<RecAttributes>): RecAttributes => ({
  shape: null, metal: null, setting: null, prongs: null, centerStone: null, origin: null, color: null,
  clarity: null, caratWeight: null, price: null, bandStyle: null, bandProfile: null, ...o,
});

let t = 0;
const ev = (action: InteractionEvent["action"], a: Partial<RecAttributes>, id = `e${++t}`, undoesId: string | null = null): InteractionEvent => ({
  id, action, undoesId, createdAt: new Date(1_700_000_000_000 + t * 1000), attributes: attrs(a),
});

describe("features", () => {
  it("derives taxonomy features incl. carat, budget and color-group bands", () => {
    const f = featuresOf(attrs({ shape: "Oval", metal: "Rose Gold", caratWeight: 1.1, price: 6000, color: "G" }));
    expect(f).toEqual(expect.arrayContaining(["shape:Oval", "metal:Rose Gold", "carat:0.75-1.25", "budget:5k-10k", "colorGroup:Near-colorless"]));
  });
});

describe("preference vector", () => {
  it("applies the weights: hard no −2, nope −1, like +1, revisit +1.25, love +2", () => {
    const v = computePreferenceVector(
      [ev("strong_dislike", { shape: "Marquise" }), ev("dislike", { shape: "Pear" }), ev("like", { shape: "Oval" }), ev("revisit", { shape: "Heart" }), ev("love", { shape: "Round" })],
      1e9,
    );
    expect(v["shape:Marquise"]).toBeCloseTo(-2);
    expect(v["shape:Pear"]).toBeCloseTo(-1);
    expect(v["shape:Oval"]).toBeCloseTo(1);
    expect(v["shape:Heart"]).toBeCloseTo(1.25);
    expect(v["shape:Round"]).toBeCloseTo(2);
  });

  it("recent swipes count more than old ones (recency decay)", () => {
    expect(recencyDecay(0)).toBe(1);
    expect(recencyDecay(25, 25)).toBeCloseTo(0.5);
    const v = computePreferenceVector([ev("like", { metal: "Platinum" }), ev("like", { metal: "Yellow Gold" })], 2);
    expect(v["metal:Yellow Gold"]!).toBeGreaterThan(v["metal:Platinum"]!);
  });

  it("undone swipes don't count", () => {
    const a = ev("love", { shape: "Emerald" });
    const v = computePreferenceVector([a, ev("undo", { shape: "Emerald" }, undefined, a.id)]);
    expect(v["shape:Emerald"]).toBeUndefined();
  });
});

describe("scoring", () => {
  it("rings matching learned taste score higher", () => {
    const v = computePreferenceVector([ev("love", { shape: "Oval", metal: "Rose Gold" }), ev("dislike", { shape: "Princess" })]);
    const oval = scoreItem(attrs({ shape: "Oval", metal: "Rose Gold" }), DEFAULT_STATED_PREFS, v).score;
    const princess = scoreItem(attrs({ shape: "Princess", metal: "Rose Gold" }), DEFAULT_STATED_PREFS, v).score;
    expect(oval).toBeGreaterThan(princess);
  });

  it("stated preferences act as a prior, and 'not sure' adds nothing", () => {
    const prefs: StatedPrefs = { ...DEFAULT_STATED_PREFS, settings: ["Halo"] };
    expect(scoreItem(attrs({ setting: "Halo" }), prefs, {}).score).toBeGreaterThan(0);
    expect(scoreItem(attrs({ setting: "Bezel" }), prefs, {}).score).toBeLessThan(0);
    expect(scoreItem(attrs({ setting: "Halo" }), DEFAULT_STATED_PREFS, {}).score).toBe(0);
  });

  it("rings well over budget are pushed down hard", () => {
    const prefs: StatedPrefs = { ...DEFAULT_STATED_PREFS, budget: { min: 2000, max: 5000 } };
    const inBudget = scoreItem(attrs({ price: 4000 }), prefs, {}).score;
    const over = scoreItem(attrs({ price: 15000 }), prefs, {}).score;
    expect(inBudget).toBeGreaterThan(0);
    expect(over).toBeLessThan(-2);
  });
});

describe("exploration", () => {
  it("keeps every item exactly once and explores about 30% of the time", () => {
    const items = Array.from({ length: 2000 }, (_, i) => i);
    const out = mixExploration(items, 0.3, "seed-1");
    expect(out.map((o) => o.item).sort((a, b) => a - b)).toEqual(items);
    const rate = out.filter((o) => o.explore).length / out.length;
    expect(rate).toBeGreaterThan(0.24);
    expect(rate).toBeLessThan(0.36);
  });

  it("is deterministic for a seed", () => {
    expect(mixExploration([1, 2, 3, 4, 5, 6], 0.3, "x")).toEqual(mixExploration([1, 2, 3, 4, 5, 6], 0.3, "x"));
  });

  it("explore rate 0 is pure best-first", () => {
    expect(mixExploration([1, 2, 3], 0, "x").map((o) => o.item)).toEqual([1, 2, 3]);
  });
});

describe("rankDeck", () => {
  const items = ["Oval", "Round", "Pear", "Heart", "Emerald", "Princess", "Oval", "Round"].map((shape, i) => ({
    id: `l${i}`, attrs: attrs({ shape, metal: i % 2 ? "Platinum" : "Rose Gold" }), item: `l${i}`,
  }));

  it("puts liked styles first (with exploration off) and explains why", () => {
    const vector = computePreferenceVector([ev("love", { shape: "Oval" }), ev("love", { shape: "Oval" })]);
    const r = rankDeck(items, { prefs: DEFAULT_STATED_PREFS, vector, exploreRate: 0, seed: "u" });
    expect(r.slice(0, 2).map((x) => x.item).sort()).toEqual(["l0", "l6"]);
    expect(r[0]!.why).toBe("Because you liked oval stones");
    expect(r).toHaveLength(items.length);
  });

  it("with no signal yet, nothing is labelled exploration and cards get the fresh line", () => {
    const r = rankDeck(items, { prefs: DEFAULT_STATED_PREFS, vector: {}, exploreRate: 0.3, seed: "u" });
    expect(r.every((x) => !x.explore && x.why === WHY_FRESH)).toBe(true);
  });

  it("stated picks are explained", () => {
    const r = rankDeck(items, { prefs: { ...DEFAULT_STATED_PREFS, metals: ["Rose Gold"] }, vector: {}, exploreRate: 0, seed: "u" });
    expect(r[0]!.why).toBe("Matches what you told us: rose gold");
  });
});

describe("why-lines and taste summary", () => {
  it("exploration cards say so", () => {
    expect(whyLine([], true)).toBe(WHY_EXPLORE);
  });

  it("needs a few swipes before summarising", () => {
    const s = tasteSummary({}, [{ id: "a", action: "like", undoesId: null }]);
    expect(s.ready).toBe(false);
    expect(s.text).toBe("Swipe 4 more rings to see your taste.");
  });

  it("summarises likes and dislikes in plain words", () => {
    const evs = [
      ev("love", { shape: "Oval", metal: "Rose Gold", setting: "Halo" }),
      ev("love", { shape: "Oval", metal: "Rose Gold" }),
      ev("like", { shape: "Oval" }),
      ev("dislike", { setting: "Bezel" }),
      ev("dislike", { setting: "Bezel" }),
    ];
    const s = tasteSummary(computePreferenceVector(evs), evs);
    expect(s.ready).toBe(true);
    expect(s.counts).toEqual({ love: 2, like: 1, revisit: 0, dislike: 2, strong_dislike: 0 });
    expect(s.text).toContain("oval stones");
    expect(s.text).toContain("rose gold");
    expect(s.text).toContain("Less keen on bezel settings");
  });
});

describe("stated prefs parsing", () => {
  it("defaults every field to 'show me everything' and drops invalid values", () => {
    expect(parseStatedPrefs(undefined)).toEqual(DEFAULT_STATED_PREFS);
    expect(parseStatedPrefs("not json")).toEqual(DEFAULT_STATED_PREFS);
    const p = parseStatedPrefs({ shapes: ["Oval", "Triangle"], metals: ["Platinum"], origin: "No preference", settings: [] });
    expect(p.shapes).toBe(ANY);
    expect(p.metals).toEqual(["Platinum"]);
    expect(p.origin).toBe(ANY);
    expect(p.settings).toBe(ANY);
  });
});
