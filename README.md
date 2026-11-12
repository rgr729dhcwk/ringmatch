# RingMatch 💍

A mobile-first "Tinder for engagement rings". Swipe through ring cards to discover your style.

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

## Tests
```bash
npm test            # unit tests (fast)
npm run test:e2e    # browser tests on Pixel 7 + desktop Chrome (several minutes)
```

## Project docs
- `docs/BRIEF.md`: product requirements
- `docs/PLAN.md`: approved architecture and milestones
- `CLAUDE.md`: conventions for contributors and AI sessions

## Coming next (Milestone 2)
Onboarding questions ("Not sure / show me everything" allowed everywhere) and smarter ordering that learns
from your swipes, with a short "why you're seeing this" line and a summary of your taste.
