import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";
import { createProfile, selectProfile } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [users, current, sp] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" }, take: 50 }),
    getCurrentUser(),
    searchParams,
  ]);
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-8 px-5 py-10">
      <header className="text-center">
        <div className="text-4xl" aria-hidden>💍</div>
        <h1 className="mt-2 font-serif text-3xl text-ink">RingMatch</h1>
        <p className="mt-2 text-sm text-ink-soft">Swipe through rings to discover your style.</p>
      </header>

      <section className="rounded-3xl bg-surface p-5 shadow-card">
        <h2 className="text-lg font-semibold text-ink">Create a profile</h2>
        <p className="mt-1 text-sm text-ink-soft">Just a name — it stays on this device. No sign-up needed.</p>
        <form action={createProfile} className="mt-4 flex gap-2">
          <label htmlFor="displayName" className="sr-only">Your name</label>
          <input
            id="displayName"
            name="displayName"
            required
            maxLength={40}
            placeholder="Your name"
            autoComplete="given-name"
            className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:border-accent"
          />
          <button type="submit" className="rounded-xl bg-accent px-5 py-3 font-semibold text-white active:scale-95">
            Start
          </button>
        </form>
        {sp.error === "name" && <p className="mt-2 text-sm text-red-600">Please enter a name.</p>}
      </section>

      {users.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">Or continue as</h2>
          <ul className="flex flex-col gap-2">
            {users.map((u) => (
              <li key={u.id}>
                <form action={selectProfile}>
                  <input type="hidden" name="userId" value={u.id} />
                  <button
                    type="submit"
                    className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-left shadow-card active:scale-[0.99]"
                  >
                    <span className="font-medium text-ink">{u.displayName}</span>
                    <span className="text-sm text-ink-soft">{current?.id === u.id ? "current" : "→"}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
