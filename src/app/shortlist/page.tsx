import Link from "next/link";
import { redirect } from "next/navigation";
import { ShortlistBoard } from "@/components/shortlist/ShortlistBoard";
import type { Card } from "@/lib/card";
import { TIER_IDS, type ShortlistLayout } from "@/lib/shortlist";
import { getCurrentUser } from "@/server/session";
import { loadShortlist } from "@/server/shortlist";

export const dynamic = "force-dynamic";

export default async function ShortlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/profiles");
  const list = await loadShortlist(user.id);
  const layout = Object.fromEntries(TIER_IDS.map((t) => [t, list[t].map((i) => i.listingId)])) as ShortlistLayout;
  const cards: Record<string, Card> = {};
  for (const t of TIER_IDS) for (const i of list[t]) cards[i.listingId] = i.card;

  return (
    <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),16px)]">
      <header className="flex items-center justify-between py-3">
        <h1 className="font-serif text-3xl text-ink">Shortlist</h1>
        <Link href="/" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white" data-testid="back-to-deck">
          Keep swiping
        </Link>
      </header>
      <ShortlistBoard initialLayout={layout} cards={cards} />
    </main>
  );
}
