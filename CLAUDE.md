# CLAUDE.md — RingMatch conventions

Read `docs/BRIEF.md` (requirements) and `docs/PLAN.md` (approved architecture) before changing anything.
The plan is approved — follow it, don't re-plan. The user is not a developer; explain things plainly.

## Non-negotiables
- **Every card must have a visual.** A card is built only via `toCard()` (`src/lib/card.ts`), whose
  `visual` is a required union: `{kind:'image', images[]}` | `{kind:'procedural', params}`. Never render
  a listing without going through `toCard()`/`buildDeck()`. Procedural cards always show the badge
  "Style preview — illustrative render" (`PROCEDURAL_BADGE` in `src/lib/visual.ts`).
- **The taxonomy lives ONLY in `src/lib/taxonomy.ts`.** Never hard-code shapes, settings, metals, prongs,
  colors, clarities etc. anywhere else — import them. Zod schemas (`src/lib/listing.ts`) validate against it.
- **No scrapers.** Data enters through adapters in `src/sources/` that output normalized listings and go
  through `ingest.ts` (normalize → image checks → procedural fallback → reject + IngestLog).
- **No paid services or API keys** without asking the user first. Secrets only in `.env` (never committed).
- **Only the top card mounts a WebGL canvas** (browser context limits). Other cards use `RingSketch` (SVG).
- `src/recs/` is pure: no DB, no React imports.
- Interactions are append-only; undo = a new row with `action:'undo'` and `undoesId`.
- Don't run `prisma db push --force-reset` / `migrate reset` (Prisma blocks AI agents from it). The e2e
  suite uses its own throwaway DB file (`prisma/e2e.db`) prepared by `scripts/e2e-prepare.mjs`.

## Layout
- `src/lib/` taxonomy, Zod listing schema, `resolveVisual`, `toCard`
- `src/sources/` adapters (`seed.adapter.ts`), `registry.ts`, `sources.config.ts`, `ingest.ts`, `imageCheck.ts`, `prismaStore.ts`
- `src/recs/` recommender (pure): `features.ts` (attributes → `dim:value` features + weights), `preferenceVector.ts`
  (action weights × recency decay, undo-aware), `score.ts` (stated prefs prior + learned taste), `explore.ts`
  (seeded ~30% exploration), `rank.ts`, `whyLine.ts` (why-lines + taste summary), `labels.ts` (plain-words phrases)
- `src/server/` db client, cookie session (`rm_uid`), `deck.ts` (ranked deck), `taste.ts` (signals + PreferenceVector cache)
- `src/lib/shortlist.ts` shortlist rules (pure): love/revisit → tiers top|strong|maybe, lazy ShortlistOrder rows,
  `removedAt` hides until re-saved, `validateLayout` only accepts a rearrangement. Server: `src/server/shortlist.ts`
- `src/components/shortlist/` ShortlistBoard (dnd-kit multi-tier sortable + tier menu + keyboard), CompareView
  (one live WebGL column at a time)
- `src/lib/prefs.ts` Zod schema for stated prefs (every field defaults to ANY = "show me everything")
- `src/app/` pages (`/profiles`, `/onboarding`, `/`, `/taste`) + route handlers (`/api/interactions`, `/api/interactions/undo`,
  `/api/deck`, `/api/taste`, `/api/shortlist` (GET/PUT), `/api/shortlist/remove`, `/api/health`); pages also `/shortlist`, `/shortlist/compare?ids=`; `/dev/ring?id=` is dev-only
- The deck client re-fetches `/api/deck` every 3 swipes and keeps the two on-screen cards; never show a card twice.
- `src/components/deck/` SwipeDeck, SwipeCard, ActionBar, CardVisual
- `src/components/ring3d/` ProceduralRing (r3f), RingSketch (SVG), `geometry/`, `materials.ts`
- `seed/listings.json` sample data (regenerate with `python3 scripts/generate-seed.py`); images in `public/seed/`
- `tests/unit/` Vitest, `tests/e2e/` Playwright (Pixel 7 + desktop Chromium)

## Commands
```bash
npm install            # also runs prisma generate
cp .env.example .env   # first time only
npm run db:push        # create/update the SQLite schema (prisma/dev.db)
npm run db:seed        # ingest seed/listings.json
npm run dev            # http://0.0.0.0:3000
npm test               # Vitest unit tests (incl. visual-guarantee tests)
npm run test:e2e       # Playwright; builds the app into .next-e2e and uses prisma/e2e.db
npm run typecheck
```

Hosting for trials: `render.yaml` (Render free plan). `npm run start:render` = db push + seed + start on `$PORT`.
The Render DB is temporary SQLite (resets on restart) — fine for trials, not for keeping data.

## Testing notes
- Specs that don't test 3D switch WebGL off (`test.use({ launchOptions: { args: ["--disable-webgl", "--disable-3d-apis"] } })`):
  the cloud machine renders WebGL in software, which is slow. The sketch fallback is then used.
- Before starting a server for checks, make sure nothing old is still listening on the port (stale servers
  serve deleted build chunks → ChunkLoadError).

## Style
TypeScript strict (`noUncheckedIndexedAccess` on). Tailwind v4 tokens are in `src/app/globals.css`.
Mobile-first: design at phone width first. Keep tests passing; add e2e coverage for new interactions.
Update the README "What's new" section at the end of each milestone.
