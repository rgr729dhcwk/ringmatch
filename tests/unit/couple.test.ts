import { describe, expect, it } from "vitest";
import {
  blendVectors,
  blendWeightAFor,
  computeMatches,
  generateInviteCode,
  INVITE_ALPHABET,
  normalizeInviteCode,
  viewFor,
  type CoupleRow,
  type Swipe,
} from "@/lib/couple";

const couple: CoupleRow = { id: "c1", userAId: "alex", userBId: "sam", inviteCode: "K7Q-M2X", blendWeightA: 0.7, surpriseA: false, surpriseB: true };

describe("invite codes", () => {
  it("are 6 easy-to-read characters, shown as ABC-DEF", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateInviteCode();
      expect(c).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
      expect([...c.replace("-", "")].every((ch) => INVITE_ALPHABET.includes(ch))).toBe(true);
    }
  });
  it("forgive spaces, dashes and lower case; reject impossible codes", () => {
    expect(normalizeInviteCode(" k7q m2x ")).toBe("K7Q-M2X");
    expect(normalizeInviteCode("K7QM2X")).toBe("K7Q-M2X");
    expect(normalizeInviteCode("K7Q-M2")).toBeNull();
    expect(normalizeInviteCode("O0I1L5")).toBeNull(); // confusable characters are never used
  });
});

describe("who sees what", () => {
  it("each partner sees their own share of the blend and the other's surprise setting", () => {
    expect(viewFor(couple, "alex")).toMatchObject({ role: "A", partnerId: "sam", myWeight: 0.7, mySurprise: false, partnerSurprise: true, partnerVisible: false });
    const sam = viewFor(couple, "sam")!;
    expect(sam).toMatchObject({ role: "B", partnerId: "alex", mySurprise: true, partnerSurprise: false, partnerVisible: true });
    expect(sam.myWeight).toBeCloseTo(0.3);
    expect(viewFor(couple, "stranger")).toBeNull();
  });
  it("a pending invite (no partner yet) shows nothing of anyone", () => {
    expect(viewFor({ ...couple, userBId: null, surpriseB: false }, "alex")).toMatchObject({ linked: false, partnerVisible: false });
  });
  it("the slider value maps to the stored weight from either side", () => {
    expect(blendWeightAFor("A", 0.8)).toBeCloseTo(0.8);
    expect(blendWeightAFor("B", 0.8)).toBeCloseTo(0.2);
    expect(blendWeightAFor("A", 7)).toBe(1);
  });
});

describe("blending and matches", () => {
  it("blends two taste vectors by weight", () => {
    const v = blendVectors({ "shape:Oval": 2, "metal:Platinum": 1 }, { "shape:Oval": -2, "setting:Halo": 4 }, 0.25);
    expect(v["shape:Oval"]).toBeCloseTo(0.5 - 1.5);
    expect(v["metal:Platinum"]).toBeCloseTo(0.25);
    expect(v["setting:Halo"]).toBeCloseTo(3);
  });

  it("matches = both currently positive (latest swipe wins), strongest first", () => {
    const t = (n: number) => new Date(1_700_000_000_000 + n * 1000);
    const mine: Swipe[] = [
      { listingId: "a", action: "love", createdAt: t(1) },
      { listingId: "b", action: "like", createdAt: t(2) },
      { listingId: "c", action: "love", createdAt: t(3) },
      { listingId: "c", action: "dislike", createdAt: t(4) }, // changed my mind
      { listingId: "d", action: "revisit", createdAt: t(5) },
    ];
    const theirs: Swipe[] = [
      { listingId: "a", action: "love", createdAt: t(1) },
      { listingId: "b", action: "revisit", createdAt: t(1) },
      { listingId: "c", action: "love", createdAt: t(1) },
      { listingId: "d", action: "strong_dislike", createdAt: t(1) },
    ];
    expect(computeMatches(mine, theirs)).toEqual([
      { listingId: "a", mine: "love", theirs: "love" },
      { listingId: "b", mine: "like", theirs: "revisit" },
    ]);
  });
});

describe("ranking with a partner", async () => {
  const { rankDeck } = await import("@/recs/rank");
  const { DEFAULT_STATED_PREFS } = await import("@/lib/taxonomy");
  const attrs = (shape: string, metal: string) => ({
    shape, metal, setting: null, prongs: null, centerStone: null, origin: null, color: null, clarity: null,
    caratWeight: null, price: null, bandStyle: null, bandProfile: null,
  });
  const items = [
    { id: "pear", attrs: attrs("Pear", "Platinum"), item: "pear" },
    { id: "oval", attrs: attrs("Oval", "Platinum"), item: "oval" },
    { id: "round", attrs: attrs("Round", "Rose Gold"), item: "round" },
  ];
  const base = { prefs: DEFAULT_STATED_PREFS, exploreRate: 0, seed: "s" };

  it("the partner's taste moves rings up and the reason names them", () => {
    const r = rankDeck(items, { ...base, vector: {}, partner: { vector: { "shape:Oval": 3 }, myWeight: 0.5, name: "Sam" } });
    expect(r[0]!.item).toBe("oval");
    expect(r[0]!.why).toBe("Because Sam liked oval stones");
  });

  it("shared likes say 'you both'", () => {
    const r = rankDeck(items, { ...base, vector: { "metal:Rose Gold": 2 }, partner: { vector: { "metal:Rose Gold": 2 }, myWeight: 0.5, name: "Sam" } });
    expect(r[0]!.item).toBe("round");
    expect(r[0]!.why).toBe("You and Sam both liked rose gold");
  });

  it("the slider decides whose taste leads", () => {
    const ctx = (myWeight: number) => ({ ...base, vector: { "shape:Pear": 2 }, partner: { vector: { "shape:Oval": 2 }, myWeight, name: "Sam" } });
    expect(rankDeck(items, ctx(0.9))[0]!.item).toBe("pear");
    expect(rankDeck(items, ctx(0.1))[0]!.item).toBe("oval");
  });
});
