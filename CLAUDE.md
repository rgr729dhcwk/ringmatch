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
- `src/recs/` recommendation algorithms (M1: simple deck order; rest stubbed for M2)
- `src/server/` db client, cookie session (`rm_uid`), deck loading
- `src/app/` pages + route handlers (`/api/interactions`, `/api/interactions/undo`, `/api/health`); `/dev/ring?id=` is dev-only
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

## Style
TypeScript strict (`noUncheckedIndexedAccess` on). Tailwind v4 tokens are in `src/app/globals.css`.
Mobile-first: design at phone width first. Keep tests passing; add e2e coverage for new interactions.
Update the README "What's new" section at the end of each milestone.
