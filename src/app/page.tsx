import Link from "next/link";
import { redirect } from "next/navigation";
import { SwipeDeck } from "@/components/deck/SwipeDeck";
import { getDeckForUser } from "@/server/deck";
import { getCurrentUser } from "@/server/session";
import { signOut } from "./profiles/actions";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/profiles");
  const sp = await searchParams;
  const { cards, total } = await getDeckForUser(user.id, { includeSeen: sp.all === "1" });

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-[max(env(safe-area-inset-top),8px)]">
      <header className="flex items-center justify-between px-1 py-2">
        <span className="font-serif text-xl text-ink">RingMatch</span>
        <form action={signOut} className="flex items-center gap-2 text-sm text-ink-soft">
          <span data-testid="profile-name">{user.displayName}</span>
          <button type="submit" className="rounded-full border border-line px-3 py-1 text-xs">
            Switch
          </button>
        </form>
      </header>
      <SwipeDeck initialCards={cards} total={total} />
      <p className="sr-only">
        Keyboard: left arrow dislike, right arrow like, up arrow love, S revisit later, Z or Backspace undo.
      </p>
      <noscript>
        <p className="text-center text-sm">RingMatch needs JavaScript for swiping. <Link href="/profiles">Profiles</Link></p>
      </noscript>
    </main>
  );
}
