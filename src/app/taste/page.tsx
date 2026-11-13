import Link from "next/link";
import { redirect } from "next/navigation";
import { ANY, type StatedPrefs } from "@/lib/taxonomy";
import { getCurrentUser } from "@/server/session";
import { getTaste } from "@/server/taste";

export const dynamic = "force-dynamic";

const PREF_LABELS: Partial<Record<keyof StatedPrefs, string>> = {
  shapes: "Shapes",
  metals: "Metals",
  settings: "Settings",
  centerStones: "Centre stone",
  origin: "Natural or lab",
  budget: "Budget",
  carat: "Size",
};

function prefValue(v: StatedPrefs[keyof StatedPrefs], key: keyof StatedPrefs): string | null {
  if (v === ANY) return null;
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") {
    const fmt = (n: number) => (key === "budget" ? "$" + n.toLocaleString("en-US") : n + " ct");
    return fmt(v.min) + " – " + fmt(v.max);
  }
  return String(v);
}

const COUNTS = [
  ["Loved", "love", "var(--color-love)"],
  ["Liked", "like", "var(--color-like)"],
  ["Revisit", "revisit", "var(--color-revisit)"],
  ["Passed", "dislike", "var(--color-nope)"],
  ["Hard no", "strong_dislike", "#8f1d17"],
] as const;

export default async function TastePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/profiles");
  const taste = await getTaste(user.id);
  const stated = (Object.keys(PREF_LABELS) as (keyof StatedPrefs)[])
    .map((k) => [PREF_LABELS[k]!, prefValue(taste.prefs[k], k)] as const)
    .filter(([, v]) => v);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-4 px-4 pb-10 pt-[max(env(safe-area-inset-top),16px)]">
      <header className="flex items-center justify-between py-2">
        <h1 className="font-serif text-3xl text-ink">Your taste</h1>
        <Link href="/" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white" data-testid="back-to-deck">
          Keep swiping
        </Link>
      </header>

      <section className="rounded-3xl bg-surface p-5 shadow-card">
        <p className="text-lg leading-snug text-ink" data-testid="taste-summary">
          {taste.text}
        </p>
        <dl className="mt-4 grid grid-cols-5 gap-1.5 text-center">
          {COUNTS.map(([label, key, color]) => (
            <div key={key} className="rounded-2xl bg-canvas py-2">
              <dd className="text-xl font-semibold" style={{ color }} data-testid={"count-" + key}>
                {taste.counts[key]}
              </dd>
              <dt className="text-[11px] text-ink-soft">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {taste.ready && (taste.likes.length > 0 || taste.dislikes.length > 0) && (
        <section className="rounded-3xl bg-surface p-5 shadow-card">
          {taste.likes.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-ink">Drawn to</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {taste.likes.slice(0, 8).map((l) => (
                  <li key={l.phrase} className="rounded-full bg-like/10 px-3 py-1 text-sm text-ink">
                    {l.phrase}
                  </li>
                ))}
              </ul>
            </>
          )}
          {taste.dislikes.length > 0 && (
            <>
              <h2 className="mt-4 text-sm font-semibold text-ink">Less keen on</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {taste.dislikes.map((l) => (
                  <li key={l.phrase} className="rounded-full bg-nope/10 px-3 py-1 text-sm text-ink">
                    {l.phrase}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="rounded-3xl bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">What you told us</h2>
          <Link href="/onboarding" className="text-sm font-semibold text-accent" data-testid="edit-prefs">
            Edit
          </Link>
        </div>
        {stated.length ? (
          <dl className="mt-2 flex flex-col gap-1.5 text-sm" data-testid="stated-prefs">
            {stated.map(([label, v]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="text-right text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-ink-soft" data-testid="stated-prefs">
            Nothing yet — you&apos;re seeing everything.
          </p>
        )}
      </section>

      <p className="px-2 text-xs text-ink-soft">
        RingMatch puts rings like the ones you love first, but about 3 in 10 cards are deliberately something different,
        so you can discover styles you hadn&apos;t considered.
      </p>
    </main>
  );
}
