# RingMatch — Approved Architecture & Plan

This plan was approved in the planning session. Later sessions should follow it rather than re-plan.

## Stack
- Next.js 15 (App Router), React 19, TypeScript strict, Tailwind v4
- Motion (Framer Motion) for swipes; dnd-kit later (Milestone 3); react-three-fiber + drei
- Prisma + SQLite (`prisma/dev.db`, gitignored), Zod, probe-image-size
- Vitest; Playwright with Pixel 7 and desktop Chromium projects

## Layout
- `src/lib/`
  - `taxonomy.ts` — the ONLY place taxonomy values are defined
  - `listing.ts` — Zod schema for normalized listings
  - `visual.ts` — `resolveVisual()`
  - `card.ts` — `toCard()`; `Card.visual` is a REQUIRED discriminated union
    `{kind:'image', images[]}` | `{kind:'procedural', params}`
- `src/recs/` — pure algorithm modules (no DB, no React). Stubbed in M1; simple deck order for now.
- `src/sources/`
  - `types.ts` — `SourceAdapter { id, enabled, fetch(): AsyncIterable<RawListing>, normalize() }`
  - `registry.ts`, `sources.config.ts` (per source: enabled, imagePolicy, rateLimit, attribution)
  - `seed.adapter.ts`, `ingest.ts`, `imageCheck.ts`
- `src/components/deck/` — `SwipeDeck`, `SwipeCard`, `ActionBar`
- `src/components/ring3d/` — `ProceduralRing`, `geometry/`, `materials.ts`
- `tests/e2e/` — Playwright tests

## Ingest pipeline
adapter → Zod normalize → validate images (drop failures, log to IngestLog) → if no valid images
remain, fall back to procedural (`renderType='procedural'`, defaults for unknown attributes) → if
neither is possible, reject and log.

## Procedural ring
- Band: lathe/torus mesh, width from `bandWidthMm`.
- Stones: Round & Old Mine use a lathed brilliant profile; other shapes use an extruded outline with
  a crown bevel. Carat scales the stone by cube root.
- Prongs: 4, 6, claw, double, compass.
- Halo & pavé: instanced small spheres. Three-stone & toi-et-moi: side stones. Bezel: metal rim.
- Materials: MeshPhysicalMaterial for metals; transmission material for stones; drei Environment.
- **Only the top card runs a live Canvas** (avoids the WebGL context limit).

## Prisma models
- **Listing** — typed nullable attribute columns (strings, validated by Zod against taxonomy) +
  sourceId, sourceUrl?, externalId?, retailer, attribution, title, price?, currency,
  priceIsEstimate, renderType (photo|360|cad|procedural), has360, lastSeenAt, active.
  Unique (sourceId, externalId).
- **ListingImage** — url, kind, width, height, validatedAt, position.
- **IngestLog** — outcome = accepted | fell_back_procedural | rejected, reason.
- **User** — displayName, email? unique (Auth.js-ready).
- **Profile** — statedPrefs JSON, exploreRate 0.3.
- **Interaction** — append-only. action = dislike|like|revisit|love|undo, undoesId? → cancelled row.
- **ShortlistOrder** — userId, listingId, tier, rank.
- **Couple** — userAId, userBId?, inviteCode unique, blendWeightA 0.5, surpriseA, surpriseB.
- **PreferenceVector** — cache: vector JSON, interactionCount, computedAt.
- Partner mode must not need a schema rewrite.

## Sample cards
Retailer "RingMatch Sample", no link-out (shows "Sample card"), price labeled "est." from a typical
market estimate. 40 diverse cards covering all shapes, settings and metals.

## Milestones
1. **(this one)** Scaffold; taxonomy/Zod/Prisma; seed adapter + ingest + image checks (unit tests
   with mocked HTTP); 40 sample cards; ProceduralRing + badge; swipe deck (drag, swipe-up love,
   5 buttons, undo, keyboard); interactions saved to DB; cookie profile picker; visual-guarantee
   tests (Vitest + Playwright); CLAUDE.md + README.md.
2. Onboarding + recommendations (preference vector, recency decay, 30% exploration, why-lines, taste summary).
3. Shortlist (dnd-kit reorder, tiers, compare).
4. Real listings + admin form.
5. Partner mode (invite code, matches, blend slider, surprise mode).
6. Polish (PWA, preloading, accessibility).
