import Link from "next/link";
import { redirect } from "next/navigation";
import { CompareView } from "@/components/shortlist/CompareView";
import { buildDeck } from "@/lib/card";
import { MAX_COMPARE } from "@/lib/shortlist";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/profiles");
  const ids = [...new Set(((await searchParams).ids ?? "").split(",").filter(Boolean))].slice(0, MAX_COMPARE);
  const rows = await db.listing.findMany({ where: { id: { in: ids } }, include: { images: { orderBy: { position: "asc" } }, videos: { orderBy: { position: "asc" } } } });
  // Cards only via buildDeck() — every column has a guaranteed visual. Keep the order the user picked.
  const byId = new Map(buildDeck(rows).map((c) => [c.id, c]));
  const cards = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));

  return (
    <main className="mx-auto max-w-3xl px-3 pb-10 pt-[max(env(safe-area-inset-top),16px)]">
      <header className="flex items-center justify-between px-1 py-3">
        <h1 className="font-serif text-3xl text-ink">Compare</h1>
        <Link href="/shortlist" className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink" data-testid="back-to-shortlist">
          Back to shortlist
        </Link>
      </header>
      {cards.length < 2 ? (
        <p className="rounded-3xl bg-surface p-6 text-center text-sm text-ink-soft shadow-card" data-testid="compare-empty">
          Pick at least two rings on your shortlist to compare them.
        </p>
      ) : (
        <CompareView cards={cards} />
      )}
    </main>
  );
}
