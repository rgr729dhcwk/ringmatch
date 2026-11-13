import { expect, test } from "@playwright/test";
import { createProfile, deck, expectTopCardVisual, interactions, topCardId } from "./helpers";

/**
 * Rapid swiping through the whole deck while it re-ranks in the background.
 * WebGL is switched off here so the test measures the deck logic, not software 3D rendering speed;
 * this also exercises the SVG fallback visual (which must still carry the badge).
 */
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-3d-apis"] } });

test("fast swiping never repeats or skips a card, and falls back to sketches without WebGL", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await createProfile(page, "Speedy", ["chip-shapes-Oval", "chip-metals-Rose Gold"]);
  const total = Number(await deck(page).getAttribute("data-remaining"));
  expect(await expectTopCardVisual(page)).toBeTruthy();
  const shown: string[] = [];
  const keys = ["ArrowUp", "ArrowRight", "ArrowLeft", "s"];
  for (let i = 0; i < total; i++) {
    shown.push((await topCardId(page))!);
    if (i % 10 === 0) await expectTopCardVisual(page);
    await page.keyboard.press(keys[i % keys.length]!);
    await expect(deck(page)).toHaveAttribute("data-index", String(i + 1));
  }
  await expect(page.getByTestId("deck-empty")).toBeVisible();
  expect(new Set(shown).size).toBe(total);
  const rows = (await interactions(page)).filter((r) => r.action !== "undo");
  expect(rows).toHaveLength(total);
  expect(new Set(rows.map((r) => r.listingId)).size).toBe(total);
});
