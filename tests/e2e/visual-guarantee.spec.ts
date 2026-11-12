import { expect, test } from "@playwright/test";
import { createProfile, deck, expectTopCardVisual, interactions, topCardId } from "./helpers";

/**
 * HARD REQUIREMENT: swipe through the ENTIRE deck and assert every card shows a visual —
 * a loaded <img> (naturalWidth > 0) or a rendered canvas plus the procedural badge.
 */
test("every card in the deck shows a visual", async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const health = await (await page.request.get("/api/health")).json();
  await createProfile(page);
  const total = Number(await deck(page).getAttribute("data-remaining"));
  expect(total).toBe(health.listings);
  expect(total).toBeGreaterThanOrEqual(40);

  const kinds = { image: 0, procedural: 0 };
  const seen = new Set<string>();
  for (let i = 0; i < total; i++) {
    await expect(deck(page)).toHaveAttribute("data-index", String(i));
    const id = await topCardId(page);
    expect(id).toBeTruthy();
    expect(seen.has(id!), `card ${id} shown twice`).toBe(false);
    seen.add(id!);
    kinds[await expectTopCardVisual(page)]++;
    await page.keyboard.press("ArrowRight");
  }
  await expect(page.getByTestId("deck-empty")).toBeVisible();
  expect(kinds.procedural).toBeGreaterThan(0);
  expect(kinds.image).toBeGreaterThan(0);
  const rows = await interactions(page);
  expect(rows.filter((r) => r.action === "like")).toHaveLength(total);
});
