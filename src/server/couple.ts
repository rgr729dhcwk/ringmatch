import { buildDeck, type Card } from "@/lib/card";
import { blendWeightAFor, computeMatches, generateInviteCode, isPositive, normalizeInviteCode, viewFor, type CoupleView, type Match, type Swipe } from "@/lib/couple";
import type { SwipeAction } from "@/lib/taxonomy";
import { effectiveInteractions } from "@/recs/preferenceVector";
import { db } from "./db";

export type PartnerContext = CoupleView & { partnerName: string | null };

/** The couple this user belongs to (as inviter or partner), if any. */
export async function getPartnerContext(userId: string): Promise<PartnerContext | null> {
  const c = await db.couple.findFirst({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: { userA: { select: { displayName: true } }, userB: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!c) return null;
  const v = viewFor(c, userId);
  if (!v) return null;
  return { ...v, partnerName: v.role === "A" ? (c.userB?.displayName ?? null) : c.userA.displayName };
}

/** Create (or return the pending) invite code. A user can only be in one partnership. */
export async function createInvite(userId: string): Promise<{ code: string } | { error: string }> {
  const existing = await getPartnerContext(userId);
  if (existing?.linked) return { error: "You're already linked with a partner." };
  if (existing) return { code: existing.inviteCode };
  for (let i = 0; i < 5; i++) {
    const code = generateInviteCode();
    try {
      await db.couple.create({ data: { userAId: userId, inviteCode: code } });
      return { code };
    } catch {
      /* code collision — try another */
    }
  }
  return { error: "Couldn't create a code. Please try again." };
}

export async function joinWithCode(userId: string, input: string): Promise<{ ok: true; partnerName: string } | { error: string }> {
  const code = normalizeInviteCode(input);
  if (!code) return { error: "That doesn't look like an invite code. It has 6 letters/numbers, like K7Q-M2X." };
  const mine = await getPartnerContext(userId);
  if (mine?.linked) return { error: "You're already linked with a partner. Leave that partnership first." };
  const c = await db.couple.findUnique({ where: { inviteCode: code }, include: { userA: { select: { displayName: true } } } });
  if (!c) return { error: "No invite found with that code. Check it and try again." };
  if (c.userAId === userId) return { error: "That's your own invite code — send it to your partner." };
  if (c.userBId) return { error: "That invite has already been used." };
  // If I had a pending invite of my own, drop it — I'm joining theirs instead.
  if (mine && !mine.linked) await db.couple.delete({ where: { id: mine.coupleId } }).catch(() => {});
  const updated = await db.couple.updateMany({ where: { id: c.id, userBId: null }, data: { userBId: userId } });
  if (updated.count !== 1) return { error: "That invite has already been used." };
  return { ok: true, partnerName: c.userA.displayName };
}

export async function leavePartnership(userId: string) {
  await db.couple.deleteMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } });
}

export async function setSurprise(userId: string, on: boolean) {
  const ctx = await getPartnerContext(userId);
  if (!ctx) return;
  await db.couple.update({ where: { id: ctx.coupleId }, data: ctx.role === "A" ? { surpriseA: on } : { surpriseB: on } });
}

/** myWeight: 0..1, how much my taste counts in our shared blend. */
export async function setBlend(userId: string, myWeight: number) {
  const ctx = await getPartnerContext(userId);
  if (!ctx?.linked || !Number.isFinite(myWeight)) return;
  await db.couple.update({ where: { id: ctx.coupleId }, data: { blendWeightA: blendWeightAFor(ctx.role, myWeight) } });
}

async function swipesOf(userId: string): Promise<Swipe[]> {
  const rows = await db.interaction.findMany({
    where: { userId },
    select: { id: true, action: true, undoesId: true, listingId: true, createdAt: true },
  });
  return effectiveInteractions(rows).map((r) => ({ listingId: r.listingId, action: r.action as SwipeAction, createdAt: r.createdAt }));
}

/** Rings we both like — only if my partner's swipes are visible to me (surprise mode hides them). */
export async function loadMatches(userId: string): Promise<{ ctx: PartnerContext | null; matches: (Match & { card: Card })[] }> {
  const ctx = await getPartnerContext(userId);
  if (!ctx?.partnerVisible || !ctx.partnerId) return { ctx, matches: [] };
  const matches = computeMatches(await swipesOf(userId), await swipesOf(ctx.partnerId));
  const rows = await db.listing.findMany({
    where: { id: { in: matches.map((m) => m.listingId) }, active: true },
    include: { images: { orderBy: { position: "asc" } }, videos: { orderBy: { position: "asc" } } },
  });
  const cardBy = new Map(buildDeck(rows).map((c) => [c.id, c]));
  return { ctx, matches: matches.flatMap((m) => (cardBy.has(m.listingId) ? [{ ...m, card: cardBy.get(m.listingId)! }] : [])) };
}

/**
 * After I swipe: is it a match? Only reported when my partner's swipes are visible to me
 * (if they're in surprise mode, I must not learn what they liked).
 */
export async function matchAfterSwipe(userId: string, listingId: string, action: SwipeAction): Promise<{ partnerName: string } | null> {
  if (!isPositive(action)) return null;
  const ctx = await getPartnerContext(userId);
  if (!ctx?.partnerVisible || !ctx.partnerId) return null;
  const theirs = (await swipesOf(ctx.partnerId)).filter((s) => s.listingId === listingId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return theirs && isPositive(theirs.action) ? { partnerName: ctx.partnerName ?? "Your partner" } : null;
}
