import { expect, test, type Page } from "@playwright/test";
import { createProfile, deck, expectNewTopCard, expectTopCardVisual, interactions, topCard, topCardId, waitForSaves } from "./helpers";

type DeckCard = { id: string; title: string; retailer: string; sourceUrl: string | null; visual: { kind: string; images?: unknown[] }; preview3d?: unknown };

/** Swipe (like) until the card matching `pick` is on top. */
async function bringToTop(page: Page, pick: (c: DeckCard) => boolean): Promise<DeckCard> {
  const { cards } = (await (await page.request.get("/api/deck")).json()) as { cards: DeckCard[] };
  const target = cards.find(pick);
  expect(target, "a matching card exists").toBeTruthy();
  for (let i = 0; i < cards.length && (await topCardId(page)) !== target!.id; i++) {
    const before = await deck(page).getAttribute("data-index");
    await page.keyboard.press("ArrowRight");
    await expect(deck(page)).not.toHaveAttribute("data-index", before!);
  }
  expect(await topCardId(page)).toBe(target!.id);
  return target!;
}

test.describe("tap a card for details: live 3D", () => {
  test("the 3D view in details can be spun by dragging, and only one 3D canvas exists", async ({ page }) => {
    test.setTimeout(180_000);
    await createProfile(page);
    await bringToTop(page, (c) => c.visual.kind === "procedural");
    await expectTopCardVisual(page);
    await page.keyboard.press("Enter");
    const view = page.getByTestId("detail-3d");
    await expect(view).toHaveAttribute("data-rendered", "true", { timeout: 90_000 });
    await expect(view).toHaveAttribute("data-render-mode", "webgl");
    expect(await page.locator("canvas").count()).toBe(1);
    const canvas = view.locator("canvas");
    const before = await canvas.screenshot();
    const b = (await canvas.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 160, b.y + b.height / 2 + 20, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(1000);
    const after = await canvas.screenshot();
    expect(Buffer.compare(before, after)).not.toBe(0); // the view changed
    await page.keyboard.press("Escape");
    await expectTopCardVisual(page); // the deck card's 3D comes back
  });
});
