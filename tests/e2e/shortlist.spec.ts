import { expect, test, type Page } from "@playwright/test";
import { createProfile, deck, expectNewTopCard, expectTopCardVisual, topCardId, waitForSaves } from "./helpers";

// The shortlist is about lists, not 3D: switch WebGL off so the deck moves quickly (sketch fallback).
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-3d-apis"] } });

async function swipe(page: Page, keys: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const k of keys) {
    const id = await topCardId(page);
    ids.push(id!);
    await page.keyboard.press(k);
    await expectNewTopCard(page, id);
  }
  await waitForSaves(page);
  return ids;
}

const itemsIn = (page: Page, tier: string) => page.getByTestId(`tier-${tier}`).getByTestId("shortlist-item");
const idsIn = (page: Page, tier: string) => itemsIn(page, tier).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.listingId!));
const waitSaved = (page: Page) => expect(page.getByTestId("shortlist")).toHaveAttribute("data-saving", "0");

async function dragHandleTo(page: Page, from: ReturnType<Page["locator"]>, to: ReturnType<Page["locator"]>, below = false) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  const tx = b.x + b.width / 2;
  const ty = b.y + (below ? b.height * 0.85 : b.height * 0.25);
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(a.x + a.width / 2 + ((tx - a.x - a.width / 2) * i) / 15, a.y + a.height / 2 + ((ty - a.y - a.height / 2) * i) / 15);
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(150);
  await page.mouse.up();
}

test.describe("Milestone 3: shortlist", () => {
  test.beforeEach(async ({ page }) => {
    await createProfile(page);
    await expectTopCardVisual(page);
  });

  test("loves and saves land in the right tiers, every item has a visual, header count is live", async ({ page }) => {
    const [l1, l2, , r1] = await swipe(page, ["ArrowUp", "ArrowUp", "ArrowRight", "s", "ArrowLeft"]);
    await expect(page.getByTestId("shortlist-count")).toHaveText("3");
    await page.getByTestId("nav-shortlist").click();
    await expect(page.getByTestId("shortlist")).toBeVisible();
    await expect.poll(() => idsIn(page, "top")).toEqual([l1, l2]);
    expect(await idsIn(page, "maybe")).toEqual([r1]);
    expect(await idsIn(page, "strong")).toEqual([]);
    for (const item of await page.getByTestId("shortlist-item").all()) {
      const sketch = item.getByTestId("thumb-sketch");
      if (await sketch.count()) {
        await expect(sketch.locator("svg")).toBeVisible();
        await expect(item.getByTestId("procedural-badge")).toHaveText("Style preview — illustrative render");
      } else {
        await expect.poll(() => item.getByTestId("thumb-image").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
      }
    }
  });

  test("drag to reorder within a tier, and drag into an empty tier; both persist", async ({ page }) => {
    const [a, b, c] = await swipe(page, ["ArrowUp", "ArrowUp", "ArrowUp"]);
    await page.getByTestId("nav-shortlist").click();
    await expect.poll(() => idsIn(page, "top")).toEqual([a, b, c]);

    // Drag the last ring above the first.
    await dragHandleTo(page, itemsIn(page, "top").nth(2).getByTestId("drag-handle"), itemsIn(page, "top").nth(0));
    await expect.poll(() => idsIn(page, "top")).toEqual([c, a, b]);
    await waitSaved(page);

    // Drag the first ring into the empty "Strong contenders" tier.
    await dragHandleTo(page, itemsIn(page, "top").nth(0).getByTestId("drag-handle"), page.getByTestId("tier-strong").locator("ul"));
    await expect.poll(() => idsIn(page, "strong")).toEqual([c]);
    await waitSaved(page);

    await page.reload();
    await expect.poll(() => idsIn(page, "top")).toEqual([a, b]);
    expect(await idsIn(page, "strong")).toEqual([c]);
  });

  test("keyboard reordering works (accessibility)", async ({ page }) => {
    const [a, b] = await swipe(page, ["ArrowUp", "ArrowUp"]);
    await page.getByTestId("nav-shortlist").click();
    await expect.poll(() => idsIn(page, "top")).toEqual([a, b]);
    await itemsIn(page, "top").nth(0).getByTestId("drag-handle").focus();
    for (const key of ["Space", "ArrowDown", "Space"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(250);
    }
    await expect.poll(() => idsIn(page, "top")).toEqual([b, a]);
    await waitSaved(page);
    await page.reload();
    await expect.poll(() => idsIn(page, "top")).toEqual([b, a]);
  });

  test("the tier menu moves a ring and it persists", async ({ page }) => {
    const [a] = await swipe(page, ["ArrowUp"]);
    await page.getByTestId("nav-shortlist").click();
    await itemsIn(page, "top").nth(0).getByTestId("tier-select").selectOption("strong");
    await expect.poll(() => idsIn(page, "strong")).toEqual([a]);
    await waitSaved(page);
    await page.reload();
    await expect.poll(() => idsIn(page, "strong")).toEqual([a]);
    expect(await idsIn(page, "top")).toEqual([]);
  });

  test("removing a ring takes it off for good and isn't counted as a dislike", async ({ page }) => {
    const [a, b] = await swipe(page, ["ArrowUp", "s"]);
    await page.getByTestId("nav-shortlist").click();
    await itemsIn(page, "top").nth(0).getByTestId("remove").click();
    await expect(itemsIn(page, "top")).toHaveCount(0);
    await waitSaved(page);
    await page.reload();
    await expect.poll(() => idsIn(page, "maybe")).toEqual([b]);
    expect(await idsIn(page, "top")).toEqual([]);
    const taste = await (await page.request.get("/api/taste")).json();
    expect(taste.counts).toMatchObject({ love: 1, revisit: 1, dislike: 0 });
    await page.getByTestId("back-to-deck").click();
    await expect(page.getByTestId("shortlist-count")).toHaveText("1");
    expect(a).toBeTruthy();
  });

  test("undoing a love on the deck takes it off the shortlist", async ({ page }) => {
    await swipe(page, ["ArrowUp"]);
    await expect(page.getByTestId("shortlist-count")).toHaveText("1");
    await page.keyboard.press("z");
    await expect(page.getByTestId("shortlist-count")).toHaveText("0");
    await waitForSaves(page);
    await page.getByTestId("nav-shortlist").click();
    await expect(page.getByTestId("shortlist-empty")).toBeVisible();
  });

  test("compare two rings side by side; at most 3 can be ticked", async ({ page }) => {
    const ids = await swipe(page, ["ArrowUp", "ArrowUp", "ArrowUp", "ArrowUp"]);
    await page.getByTestId("nav-shortlist").click();
    const toggles = page.getByTestId("compare-toggle");
    await toggles.nth(0).check();
    await expect(page.getByTestId("compare-go")).toHaveCount(0);
    await toggles.nth(1).check();
    await toggles.nth(2).check();
    await expect(toggles.nth(3)).toBeDisabled();
    await toggles.nth(2).uncheck();
    await page.getByTestId("compare-go").click();

    const compare = page.getByTestId("compare");
    await expect(compare).toHaveAttribute("data-columns", "2");
    const cols = page.getByTestId("compare-column");
    expect(await cols.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.listingId))).toEqual(ids.slice(0, 2));
    for (const col of await cols.all()) {
      const visual = col.getByTestId("card-visual");
      await expect(visual).toBeVisible();
      if ((await visual.getAttribute("data-visual-kind")) === "procedural") {
        await expect(visual.getByTestId("procedural-badge")).toBeVisible();
      }
    }
    await expect(page.locator('[data-testid=compare-row][data-label="Price"]')).toBeVisible();
    expect(await page.locator('[data-testid=compare-row][data-differs="1"]').count()).toBeGreaterThan(0);
    await expect(deck(page)).toHaveCount(0);
  });
});
