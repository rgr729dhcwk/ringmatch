# RingMatch 💍

A mobile-first "Tinder for engagement rings". Swipe through ring cards to discover your style.

## What's new — Milestone 4
- **Real ring listings**, entered by hand on a private **admin page** (`/admin`), no scraping. For each ring:
  the shop, the link to its listing, the price, photo addresses (one per line) and its details.
- **Every photo is checked** before it's shown (it must load, be a real image and be at least 600px).
  Bad photos are skipped with the reason shown. If none pass, the ring gets an illustrative 3D render from its
  details; if there isn't enough to draw (no shape or setting), it's not saved, with an explanation.
- Real rings appear in the deck alongside the samples, with the shop's name, the real price and a
  **View listing ↗** link. They're learned from and shortlisted like any other ring.
- **Edit**, **hide/show**, and **download/import** listings. On the free hosting plan the database resets
  when the app restarts, so download your listings to keep them; listings saved into
  `seed/manual-listings.json` load automatically on every start.
- The admin page is switched off unless an `ADMIN_PASSWORD` (8+ characters) is set.

## What's new — Milestone 3
- **Shortlist**: every ring you tap *Love it* or *Revisit later* on is collected here, in three tiers:
  **Top picks** (loves start here), **Strong contenders**, and **Maybe** (saved-for-later starts here).
  The header shows how many you've saved, updating as you swipe.
- **Reorder by dragging**: drag the ⠿ handle to reorder or move rings between tiers (on a phone, press
  and hold the handle first). There's also a tier menu on each ring, and keyboard reordering
  (Space to pick up, arrows to move, Space to drop).
- **Remove** a ring from the shortlist without it counting as a dislike. Undoing a love on the deck also
  takes it off.
- **Compare** 2–3 rings side by side: pictures, price and every spec, with the differences in bold.
  Tap "View in 3D" to spin one of them.

## What's new — Milestone 2
- **A few quick questions to start**: shapes, metal, setting style, centre stone, natural or lab-grown,
  budget and size, plus optional extras (colour, clarity, cut, prongs, band). Every question starts on
  *"Not sure / show me everything"*, and you can skip the whole thing. Change your answers any time
  under **Preferences**.
- **The deck learns from your swipes.** Love counts most (+3), then Revisit later (+2), Like (+1), and a
  pass counts against (−1). Recent swipes count more than old ones. Every few swipes the cards ahead of
  you are quietly re-ordered, without changing the card you're looking at.
- **About 3 in 10 cards are deliberately different** (marked 🧭), so you keep discovering styles.
- **Every card says why it's there**, e.g. "Because you liked oval stones and rose gold" or
  "Matches what you told us: halo settings".
- **My taste** page: a plain-words summary of what you're drawn to and what you pass on, your swipe
  counts, and your onboarding answers.

## What's new — Milestone 1
- **Swipe deck**: drag a card right to like it or left to pass, or swipe up for **Love it**. Buttons do the
  same, plus **Revisit later** and **Undo**. On a computer: ← nope, → like, ↑ love, S revisit, Z or
  Backspace undo.
- **Every card has a picture.** Listings with good photos show them (each image is checked: it must load,
  be a real image and be at least 600px). Listings without one get a live 3D ring drawn from their details
  (shape, carat, setting, prongs, metal, band), labelled *"Style preview — illustrative render"*.
- **43 sample rings** covering every shape, setting, metal and prong style (40 drawn in 3D, 3 with studio
  images). They're marked "Sample card", with an estimated price ("est.") and no shop link.
- **Your swipes are saved** to a small local database, per profile. Undo really cancels a swipe.
- **Profiles without sign-up**: pick or create a profile by name; it's remembered on that device.
- **Automated checks** that fail if any card could ever appear without a picture, plus tests for drag,
  keyboard, buttons, love, revisit and undo on a phone-sized and a desktop browser.

## Running it
Needs Node.js 20+.
```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```
Open http://localhost:3000 (the server listens on all interfaces, so other devices on your network can use
`http://<your-computer's-IP>:3000`).

## Trying it online (Render, free)
`render.yaml` sets RingMatch up as a free Render web service:
1. Go to https://render.com and sign up with your GitHub account.
2. Choose **New → Blueprint**, connect the `ringmatch` repository, and click **Apply**.
3. When the deploy finishes (about 5 minutes), open the `…onrender.com` link Render shows, on any device.

**Admin password on Render:** Render creates a random `ADMIN_PASSWORD` for you. Find it in the Render
dashboard → your **ringmatch** service → **Environment**. You can change it there to something memorable
(8+ characters); the app restarts with the new one.

Free-plan notes: the app sleeps after ~15 minutes without visitors (the next visit takes about a minute to
wake it), and profiles/swipes reset whenever it restarts or redeploys. The sample rings reload automatically.
Every push to `main` redeploys it.

## Tests
```bash
npm test            # unit tests (fast)
npm run test:e2e    # browser tests on Pixel 7 + desktop Chrome (several minutes)
```

## Project docs
- `docs/BRIEF.md`: product requirements
- `docs/PLAN.md`: approved architecture and milestones
- `CLAUDE.md`: conventions for contributors and AI sessions

## Coming next (Milestone 5)
Partner mode: invite your partner with a code, see the rings you both like, blend your tastes with a
slider, and a surprise mode that hides one partner's swipes.
