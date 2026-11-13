/**
 * Partner mode rules (pure — no DB or React).
 * Couple row: userA (inviter), userB (joiner), blendWeightA = share of A's taste in the shared blend,
 * surpriseA/B = that partner hides their own swipes from the other.
 */
import type { SwipeAction } from "./taxonomy";

/** No 0/O, 1/I/L — codes get read aloud and typed on phones. */
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(random: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += INVITE_ALPHABET[Math.floor(random() * INVITE_ALPHABET.length)];
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

/** Accepts "k7q m2x", "K7QM2X", "k7q-m2x" … → "K7Q-M2X" (or null if it can't be a code). */
export function normalizeInviteCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length !== 6 || [...s].some((c) => !INVITE_ALPHABET.includes(c))) return null;
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

export type CoupleRow = {
  id: string;
  userAId: string;
  userBId: string | null;
  inviteCode: string;
  blendWeightA: number;
  surpriseA: boolean;
  surpriseB: boolean;
};

export type CoupleView = {
  coupleId: string;
  inviteCode: string;
  linked: boolean;
  role: "A" | "B";
  partnerId: string | null;
  /** 0..1 — how much MY taste counts in the shared blend. */
  myWeight: number;
  mySurprise: boolean;
  partnerSurprise: boolean;
  /** Can I see my partner's swipes (taste, matches, match pop-ups, blended deck)? */
  partnerVisible: boolean;
};

export function viewFor(c: CoupleRow, me: string): CoupleView | null {
  const role = c.userAId === me ? "A" : c.userBId === me ? "B" : null;
  if (!role) return null;
  const partnerSurprise = role === "A" ? c.surpriseB : c.surpriseA;
  return {
    coupleId: c.id,
    inviteCode: c.inviteCode,
    linked: Boolean(c.userBId),
    role,
    partnerId: role === "A" ? c.userBId : c.userAId,
    myWeight: role === "A" ? c.blendWeightA : 1 - c.blendWeightA,
    mySurprise: role === "A" ? c.surpriseA : c.surpriseB,
    partnerSurprise,
    partnerVisible: Boolean(c.userBId) && !partnerSurprise,
  };
}

/** Slider value (my share, 0..1) → stored blendWeightA. */
export function blendWeightAFor(role: "A" | "B", myWeight: number): number {
  const w = Math.min(1, Math.max(0, myWeight));
  return role === "A" ? w : 1 - w;
}

/** Weighted mix of two taste vectors. */
export function blendVectors(mine: Record<string, number>, partner: Record<string, number>, myWeight: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(mine)) out[k] = (out[k] ?? 0) + v * myWeight;
  for (const [k, v] of Object.entries(partner)) out[k] = (out[k] ?? 0) + v * (1 - myWeight);
  return out;
}

export const POSITIVE_ACTIONS: readonly SwipeAction[] = ["like", "revisit", "love"];
const RANK: Record<string, number> = { love: 3, revisit: 2, like: 1 };

export type Swipe = { listingId: string; action: SwipeAction; createdAt: Date };
export type Match = { listingId: string; mine: SwipeAction; theirs: SwipeAction };

function latest(swipes: Swipe[]): Map<string, Swipe> {
  const m = new Map<string, Swipe>();
  for (const s of swipes) {
    const prev = m.get(s.listingId);
    if (!prev || s.createdAt.getTime() >= prev.createdAt.getTime()) m.set(s.listingId, s);
  }
  return m;
}

/** Rings both partners currently like, saved or love (latest swipe each), strongest first. */
export function computeMatches(mine: Swipe[], theirs: Swipe[]): Match[] {
  const a = latest(mine);
  const b = latest(theirs);
  const out: Match[] = [];
  for (const [id, s] of a) {
    const t = b.get(id);
    if (t && POSITIVE_ACTIONS.includes(s.action) && POSITIVE_ACTIONS.includes(t.action)) out.push({ listingId: id, mine: s.action, theirs: t.action });
  }
  return out.sort((x, y) => RANK[y.mine]! + RANK[y.theirs]! - (RANK[x.mine]! + RANK[x.theirs]!) || x.listingId.localeCompare(y.listingId));
}

export const isPositive = (a: string) => (POSITIVE_ACTIONS as readonly string[]).includes(a);
