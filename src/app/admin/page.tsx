import Link from "next/link";
import { ImportForm } from "@/components/admin/ImportForm";
import { formatPrice } from "@/lib/card";
import { isAdmin, isAdminConfigured } from "@/server/admin";
import { listManualListings, recentIngestLogs } from "@/server/manualListings";
import { loginAction, logoutAction, setActiveAction } from "./actions";

export const dynamic = "force-dynamic";

const OUTCOME_LABEL: Record<string, string> = {
  accepted: "Photos OK",
  fell_back_procedural: "3D preview (no usable photo)",
  rejected: "Rejected",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isAdminConfigured()) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-serif text-3xl text-ink">Admin</h1>
        <p className="mt-3 rounded-2xl bg-surface p-4 text-sm text-ink shadow-card" data-testid="admin-disabled">
          The admin area is switched off. To switch it on, set an <code>ADMIN_PASSWORD</code> (at least 8 characters) in the
          app&apos;s environment settings.
        </p>
      </main>
    );
  }

  if (!(await isAdmin())) {
    const { error } = await searchParams;
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-serif text-3xl text-ink">Admin</h1>
        <form action={loginAction} className="mt-4 flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-card" data-testid="admin-login">
          <label htmlFor="password" className="text-sm font-semibold text-ink">
            Admin password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-accent"
          />
          {error && (
            <p className="text-sm text-red-700" data-testid="admin-login-error">
              That password didn&apos;t match.
            </p>
          )}
          <button type="submit" className="rounded-xl bg-accent px-5 py-3 font-semibold text-white">
            Sign in
          </button>
        </form>
      </main>
    );
  }

  const [listings, logs] = await Promise.all([listManualListings(), recentIngestLogs(20)]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pb-16 pt-[max(env(safe-area-inset-top),16px)]" data-testid="admin">
      <header className="flex items-center justify-between py-2">
        <h1 className="font-serif text-3xl text-ink">Admin</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/" className="rounded-full border border-line px-3 py-1.5 text-ink-soft">
            App
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="rounded-full border border-line px-3 py-1.5 text-ink-soft">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Real listings ({listings.length})</h2>
          <Link href="/admin/listings/new" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white" data-testid="add-listing">
            + Add a listing
          </Link>
        </div>
        {listings.length === 0 ? (
          <p className="rounded-2xl bg-surface p-4 text-sm text-ink-soft shadow-card" data-testid="no-listings">
            No real listings yet. Add one from a jeweller&apos;s website: copy the link, the price, the photo addresses and the
            ring&apos;s details.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {listings.map((l) => (
              <li
                key={l.id}
                className={`flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card ${l.active ? "" : "opacity-60"}`}
                data-testid="admin-listing"
                data-listing-id={l.id}
                data-active={l.active ? "1" : "0"}
              >
                <div className="visual-backdrop h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  {l.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.images[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-ink-soft">3D</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{l.title}</p>
                  <p className="text-xs text-ink-soft">
                    {l.retailer}
                    {l.price != null && ` · ${formatPrice({ amount: l.price, currency: l.currency, isEstimate: l.priceIsEstimate })}`} ·{" "}
                    {OUTCOME_LABEL[l.ingestLogs[0]?.outcome ?? ""] ?? l.renderType}
                    {!l.active && " · hidden"}
                  </p>
                </div>
                <Link href={`/admin/listings/${l.id}`} className="text-sm font-semibold text-accent" data-testid="edit-listing">
                  Edit
                </Link>
                <form action={setActiveAction}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="active" value={l.active ? "0" : "1"} />
                  <button type="submit" className="text-sm text-ink-soft" data-testid="toggle-active">
                    {l.active ? "Hide" : "Show"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-3xl bg-surface p-4 shadow-card">
        <h2 className="font-semibold text-ink">Keep your listings</h2>
        <p className="text-sm text-ink-soft">
          On the free hosting plan the database is wiped when the app restarts. Download your listings to keep a copy. Paste the
          file back below to restore them, or send it to Claude to make them permanent (they then load on every start).
        </p>
        <a href="/api/admin/export" className="self-start rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink" data-testid="export">
          Download listings (JSON)
        </a>
        <ImportForm />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-ink">Recent photo checks</h2>
        {logs.length === 0 && <p className="text-xs text-ink-soft">Results appear here when you add or import listings.</p>}
        <ul className="flex flex-col gap-1 text-xs" data-testid="ingest-log">
          {logs.map((g) => (
            <li key={g.id} className="rounded-xl bg-surface px-3 py-2 shadow-card">
              <span className="font-semibold">{OUTCOME_LABEL[g.outcome] ?? g.outcome}</span>
              {g.externalId ? ` · ${g.externalId}` : ""}
              {g.reason ? ` — ${g.reason}` : ""}
              <span className="float-right text-ink-soft">{g.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
