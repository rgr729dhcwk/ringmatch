# RingMatch — Product Brief (condensed)

RingMatch is a mobile-first "Tinder for engagement rings": swipe through ring cards to discover your taste.

## Hard requirements
1. **Every card must have a visual. No exceptions.** A card is shown only if it has ≥1 valid image
   (photo, 360° frame or CAD render) or a generated 3D render.
   - At ingestion, validate image URLs: HTTP 200, `image/*` content-type, longest side ≥ ~600px.
     Reject failures and log the reason.
   - Fallback: a procedural three.js / react-three-fiber ring rendered from attributes (shape,
     carat scales the stone, setting style, prong count, metal color, band width), labeled
     **"Style preview — illustrative render"**.
   - An automated test must fail if any deck card can render without a visual.
2. **One card per view:** large visual, key specs (shape, carat, color, clarity, metal, setting
   style, price if known), source retailer, link to the original listing.
3. **Gestures and buttons both work:**
   - Swipe left = dislike, right = like.
   - Swipe up or buttons for "Love it" (strong save) and "Revisit later" (bookmark).
   - Undo last swipe.
   - Desktop keys: ← dislike, → like, ↑ love, S revisit, Z/Backspace undo.
4. **Mobile-first.** PWA comes in Milestone 6.

## Taxonomy (defined ONLY in `src/lib/taxonomy.ts`)
- Shape: Round, Oval, Cushion, Emerald, Princess, Pear, Marquise, Radiant, Asscher, Heart,
  Elongated Cushion, Old Mine/Old European
- Cut: Ideal/Excellent, Very Good, Good, Fair
- Color: D–Z, grouped Colorless D–F, Near-colorless G–J, Faint K–M
- Clarity: FL, IF, VVS1, VVS2, VS1, VS2, SI1, SI2, I1–I3
- Carat: range
- Origin: Natural, Lab-grown, No preference
- Center stone: Diamond, Moissanite, Sapphire, Other
- Setting: Solitaire, Halo, Hidden Halo, Three-Stone, Pavé, Bezel, Vintage/Milgrain, Toi et Moi,
  Cathedral, Split Shank, Cluster
- Prongs: 4, 6, Claw, Double, Compass (N-S-E-W)
- Metal: Yellow Gold, White Gold, Rose Gold, Platinum, Two-tone
- Band: width (mm), plain vs pavé, tapered vs straight
- Budget: range

Every preference field gets a "Not sure / show me everything" default (used in Milestone 2).

## Data sources
Pluggable `src/sources/` layer; every adapter outputs normalized Listing records. Milestone 1:
only the seed adapter (`seed/listings.json`) plus ~40 attribute-only sample cards using the
procedural renderer. **No scrapers.**

## Constraints / decisions
- Local profiles in a cookie instead of real auth (schema is Auth.js-ready).
- No paid services or API keys (ask the user first if one ever seems needed).
- Secrets only in `.env`, never committed.
- The user can't install Node locally; everything is built and tested in the cloud environment.

## Milestones
1. Scaffold, taxonomy, schemas, seed ingest + image checks, procedural ring, swipe deck, visual-guarantee tests.
2. Onboarding + recommendations: preference vector (dislike −1, like +1, revisit +2, love +3),
   recency decay, 30% exploration, why-lines, taste summary.
3. Shortlist: drag reorder, tiers, compare.
4. Real listings with an admin form.
5. Partner mode: couples via invite code, matches, blend slider, surprise mode (hides one partner's swipes).
6. Polish: PWA, preloading, accessibility.
