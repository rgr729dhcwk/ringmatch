import Link from "next/link";
import { redirect } from "next/navigation";
import { ShortlistCount } from "@/components/deck/ShortlistCount";
import { SwipeDeck } from "@/components/deck/SwipeDeck";
import { db } from "@/server/db";
import { getDeckForUser } from "@/server/deck";
import { getCurrentUser } from "@/server/session";
import { shortlistCount } from "@/server/shortlist";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/profiles");
  const profile = await db.profile.findUnique({ where: { userId: user.id }, select: { onboardedAt: true } });
  if (!profile?.onboardedAt) redirect("/onboarding");
  const includeSeen = (await searchParams).all === "1";
  // Count first: loading the deck refreshes taste caches, the count only reads.
  const saved = await shortlistCount(user.id);
  const { cards, total } = await getDeckForUser(user.id, { includeSeen });

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-[max(env(safe-area-inset-top),8px)]">
      <header className="flex items-center justify-between gap-2 px-1 py-2">
        <div className="min-w-0">
          <span className="block font-serif text-xl leading-none text-ink">RingMatch</span>
          <Link href="/profiles" className="block truncate text-[11px] text-ink-soft" data-testid="profile-name">
            {user.displayName}
          </Link>
        </div>
        <nav className="flex shrink-0 items-center gap-1.5 text-xs">
          <Link href="/shortlist" className="rounded-full bg-surface px-3 py-1.5 font-semibold text-love shadow-card" data-testid="nav-shortlist">
            Shortlist <ShortlistCount initial={saved} />
          </Link>
          <Link href="/taste" className="rounded-full bg-surface px-3 py-1.5 font-semibold text-accent shadow-card" data-testid="nav-taste">
            My taste
          </Link>
          <Link href="/onboarding" className="rounded-full border border-line px-3 py-1.5 text-ink-soft" data-testid="nav-prefs">
            Preferences
          </Link>
        </nav>
      </header>
      <SwipeDeck initialCards={cards} total={total} includeSeen={includeSeen} />
      <p className="sr-only">
        Keyboard: left arrow dislike, right arrow like, up arrow love, S revisit later, Z or Backspace undo.
      </p>
    </main>
  );
}
