import Link from "next/link";
import { redirect } from "next/navigation";
import { BlendSlider } from "@/components/partner/BlendSlider";
import { ShareInvite } from "@/components/partner/ShareInvite";
import { RingSketch } from "@/components/ring3d/RingSketch";
import { formatPrice, type Card } from "@/lib/card";
import type { SwipeAction } from "@/lib/taxonomy";
import { loadMatches } from "@/server/couple";
import { getCurrentUser } from "@/server/session";
import { getTaste } from "@/server/taste";
import { createInviteAction, joinAction, leaveAction, surpriseAction } from "./actions";

export const dynamic = "force-dynamic";

/** "You love it · Sam saved it" */
const MY_VERB: Partial<Record<SwipeAction, string>> = { love: "♥ You love it", revisit: "🔖 You saved it", like: "👍 You like it" };
const THEIR_VERB: Partial<Record<SwipeAction, string>> = { love: "loves it", revisit: "saved it", like: "likes it" };

function Thumb({ card }: { card: Card }) {
  if (card.visual.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={card.visual.images[0].url} alt="" className="h-full w-full object-cover" />;
  }
  return (
    <div className="h-full w-full p-1">
      <RingSketch params={card.visual.params} />
    </div>
  );
}

export default async function PartnerPage({ searchParams }: { searchParams: Promise<{ error?: string; code?: string; joined?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/profiles");
  const sp = await searchParams;
  const { ctx, matches } = await loadMatches(user.id);
  const partnerTaste = ctx?.partnerVisible && ctx.partnerId ? await getTaste(ctx.partnerId) : null;
  const name = ctx?.partnerName ?? "your partner";

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-4 px-4 pb-12 pt-[max(env(safe-area-inset-top),16px)]" data-testid="partner-page">
      <header className="flex items-center justify-between py-2">
        <h1 className="font-serif text-3xl text-ink">{ctx?.linked ? `You & ${name}` : "Partner"}</h1>
        <Link href="/" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white" data-testid="back-to-deck">
          Keep swiping
        </Link>
      </header>

      {sp.error && (
        <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-800" data-testid="partner-error">
          {sp.error}
        </p>
      )}

      {!ctx && (
        <>
          <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Swipe together</h2>
            <p className="text-sm text-ink-soft">
              Link up with your partner to see the rings you <b>both</b> like, and blend your tastes so the deck suits you both.
            </p>
            <form action={createInviteAction}>
              <button type="submit" className="w-full rounded-xl bg-accent px-5 py-3 font-semibold text-white" data-testid="create-invite">
                Invite my partner
              </button>
            </form>
          </section>
          <JoinForm defaultCode={sp.code} />
        </>
      )}

      {ctx && !ctx.linked && (
        <>
          <section className="flex flex-col items-center gap-3 rounded-3xl bg-surface p-5 text-center shadow-card">
            <h2 className="text-lg font-semibold text-ink">Your invite code</h2>
            <p className="font-mono text-4xl font-bold tracking-widest text-accent" data-testid="invite-code">
              {ctx.inviteCode}
            </p>
            <p className="text-sm text-ink-soft">
              Send this to your partner. They make their own RingMatch profile, open <b>Partner</b>, and enter the code.
            </p>
            <ShareInvite code={ctx.inviteCode} />
            <p className="text-xs text-ink-soft" data-testid="waiting">
              Waiting for your partner to join…
            </p>
          </section>
          <JoinForm defaultCode={sp.code} note="Did your partner send you a code instead? Enter it here." />
          <form action={leaveAction} className="text-center">
            <button type="submit" className="text-sm text-ink-soft underline" data-testid="cancel-invite">
              Cancel invite
            </button>
          </form>
        </>
      )}

      {ctx?.linked && (
        <>
          {sp.joined && (
            <p className="rounded-2xl bg-like/10 p-3 text-sm text-ink" data-testid="joined">
              You&apos;re linked with {name}! 💞
            </p>
          )}

          <section className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-card">
            <h2 className="font-semibold text-ink">
              Your matches <span className="text-ink-soft">({matches.length})</span>
            </h2>
            {!ctx.partnerVisible ? (
              <p className="text-sm text-ink-soft" data-testid="partner-hidden">
                {name} has surprise mode on, so their swipes are private. 🤫 Your matches will show here if they switch it off.
              </p>
            ) : matches.length === 0 ? (
              <p className="text-sm text-ink-soft" data-testid="no-matches">
                No matches yet. Rings you both like, save or love will appear here.
              </p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="matches">
                {matches.map((m) => (
                  <li key={m.listingId} className="flex items-center gap-3" data-testid="match" data-listing-id={m.listingId}>
                    <div className="visual-backdrop h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                      <Thumb card={m.card} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{m.card.title}</p>
                      <p className="text-[12px] text-ink-soft">
                        {MY_VERB[m.mine]} · {name} {THEIR_VERB[m.theirs]}
                      </p>
                      <p className="text-[12px] text-ink-soft">
                        {m.card.price ? formatPrice(m.card.price) : ""} {m.card.price ? "·" : ""} {m.card.retailer}
                        {m.card.sourceUrl && (
                          <>
                            {" · "}
                            <a href={m.card.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent">
                              View ↗
                            </a>
                          </>
                        )}
                      </p>
                      {m.card.visual.kind === "procedural" && <p className="text-[10px] text-ink-soft">Style preview — illustrative render</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2 rounded-3xl bg-surface p-4 shadow-card" data-testid="blend">
            <h2 className="font-semibold text-ink">Whose taste leads the deck?</h2>
            {ctx.partnerVisible ? (
              <>
                <p className="text-xs text-ink-soft">Both of your decks use this blend. Either of you can change it.</p>
                <BlendSlider initial={ctx.myWeight} partnerName={name} />
              </>
            ) : (
              <p className="text-xs text-ink-soft">While {name}&apos;s swipes are private, your deck uses only your own taste.</p>
            )}
          </section>

          <section className="flex flex-col gap-2 rounded-3xl bg-surface p-4 shadow-card">
            <h2 className="font-semibold text-ink">Surprise mode 🤫</h2>
            <p className="text-xs text-ink-soft">
              Planning a surprise? Hide <b>your</b> swipes from {name}: they won&apos;t see your matches, your taste or match alerts.
              You can still see theirs (unless they turn it on too).
            </p>
            <form action={surpriseAction} className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink" data-testid="surprise-state">
                {ctx.mySurprise ? "On — your swipes are private" : "Off"}
              </span>
              <input type="hidden" name="on" value={ctx.mySurprise ? "0" : "1"} />
              <button type="submit" className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink" data-testid="toggle-surprise">
                {ctx.mySurprise ? "Turn off" : "Turn on"}
              </button>
            </form>
          </section>

          {partnerTaste && (
            <section className="flex flex-col gap-1 rounded-3xl bg-surface p-4 shadow-card">
              <h2 className="font-semibold text-ink">{name}&apos;s taste</h2>
              <p className="text-sm text-ink" data-testid="partner-taste">
                {partnerTaste.ready
                  ? partnerTaste.text.replace(/^You lean toward/, `${name} leans toward`).replace(/^No strong favourites yet/, `${name} has no strong favourites yet`)
                  : `${name} hasn't swiped enough yet to show a taste.`}
              </p>
            </section>
          )}

          <form action={leaveAction} className="text-center">
            <button type="submit" className="text-sm text-ink-soft underline" data-testid="leave">
              Leave this partnership
            </button>
          </form>
        </>
      )}

      <p className="px-2 text-xs text-ink-soft">
        Each of you uses your own profile, on your own phone. On the free hosting plan, partnerships reset when the app restarts.
      </p>
    </main>
  );
}

function JoinForm({ defaultCode, note }: { defaultCode?: string; note?: string }) {
  return (
    <form action={joinAction} className="flex flex-col gap-2 rounded-3xl bg-surface p-5 shadow-card" data-testid="join-form">
      <label htmlFor="code" className="text-sm font-semibold text-ink">
        Have a code from your partner?
      </label>
      {note && <p className="-mt-1 text-xs text-ink-soft">{note}</p>}
      <div className="flex gap-2">
        <input
          id="code"
          name="code"
          required
          defaultValue={defaultCode}
          placeholder="K7Q-M2X"
          autoCapitalize="characters"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 font-mono uppercase tracking-widest outline-none focus:border-accent"
          data-testid="join-code"
        />
        <button type="submit" className="rounded-xl bg-ink px-5 py-3 font-semibold text-white" data-testid="join">
          Join
        </button>
      </div>
    </form>
  );
}
