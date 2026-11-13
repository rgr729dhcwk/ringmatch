import { expect, test, type Page } from "@playwright/test";
import { createProfile, deck, expectNewTopCard, expectTopCardVisual, interactions, topCard, topCardId, waitForSaves } from "./helpers";

type DeckCard = {
  id: string;
  title: string;
  retailer: string;
  sourceUrl: string | null;
  visual: { kind: string; images?: unknown[] };
  preview3d?: unknown;
  videos: { url: string; posterUrl: string | null }[];
};

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

// Lists and photos: WebGL off for speed (the 3D view falls back to its sketch).
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-3d-apis"] } });

test.describe("tap a card for details", () => {

  test("tap opens details; Esc closes; Enter opens; the deck card gives up its 3D while open", async ({ page }) => {
    await createProfile(page);
    await expectTopCardVisual(page);
    const id = await topCardId(page);
    const box = (await topCard(page).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
    const detail = page.getByTestId("card-detail");
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute("data-card-id", id!);
    await page.keyboard.press("Escape");
    await expect(detail).toHaveCount(0);
    expect(await topCardId(page)).toBe(id); // closing doesn't swipe
    await page.keyboard.press("Enter");
    await expect(detail).toBeVisible();
    // Arrow keys belong to the detail view now — they must not swipe the deck.
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Escape");
    expect(await topCardId(page)).toBe(id);
    expect(await interactions(page)).toHaveLength(0);
  });
  
  test("a real retailer listing: photo gallery, specs, shop link on card and in details", async ({ page }) => {
    await createProfile(page);
    const card = await bringToTop(page, (c) => c.visual.kind === "image" && (c.visual.images?.length ?? 0) > 1 && Boolean(c.sourceUrl) && Boolean(c.preview3d));
    await expect(topCard(page).getByTestId("card-retailer")).toHaveText(card.retailer);
    await expect(topCard(page).getByRole("link", { name: /View listing/ })).toHaveAttribute("href", card.sourceUrl!);
    await page.keyboard.press("Enter");
    const n = card.visual.images!.length;
    await expect(page.getByTestId("detail-photo-index")).toHaveText(`1 / ${n}`);
    await expect.poll(() => page.getByTestId("detail-photo").first().evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    await page.getByTestId("detail-next-photo").click();
    await expect(page.getByTestId("detail-photo-index")).toHaveText(`2 / ${n}`);
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("detail-photo-index")).toHaveText(`3 / ${n}`);
    await expect(page.getByTestId("detail-specs")).toContainText("Shape");
    await expect(page.getByTestId("detail-shop-link")).toHaveAttribute("href", card.sourceUrl!);
    await expect(page.getByTestId("detail-shop-link")).toHaveText(`View at ${card.retailer} ↗`);
    // The 3D tab shows the illustrative preview (sketch fallback here, as WebGL is off) with its badge.
    await page.getByTestId("detail-tab-3d").click();
    await expect(page.getByTestId("detail-3d")).toHaveAttribute("data-rendered", "true");
    await expect(page.getByTestId("detail-3d").getByTestId("procedural-badge")).toHaveText("Style preview — illustrative render");
  });
  
  test("deciding from the detail view (Love it, Hard no) swipes the card and records it", async ({ page }) => {
    await createProfile(page);
    await expectTopCardVisual(page);
    const a = await topCardId(page);
    await page.keyboard.press("Enter");
    await page.getByTestId("detail-action-love").click();
    await expect(page.getByTestId("card-detail")).toHaveCount(0);
    await expectNewTopCard(page, a);
    const b = await topCardId(page);
    await page.keyboard.press("Enter");
    await page.getByTestId("detail-action-strong_dislike").click();
    await expectNewTopCard(page, b);
    await waitForSaves(page);
    const rows = (await interactions(page)).reverse();
    expect(rows.map((r) => [r.listingId, r.action])).toEqual([
      [a, "love"],
      [b, "strong_dislike"],
    ]);
  });
  
  test("Hard no button records a strong dislike and counts on the taste page", async ({ page }) => {
    await createProfile(page);
    await expectTopCardVisual(page);
    const a = await topCardId(page);
    await page.getByTestId("action-strong_dislike").click();
    await expectNewTopCard(page, a);
    await waitForSaves(page);
    expect((await interactions(page))[0]).toMatchObject({ listingId: a, action: "strong_dislike" });
    await page.getByTestId("nav-taste").click();
    await expect(page.getByTestId("count-strong_dislike")).toHaveText("1");
  });

  test("a retailer video plays in the Video tab, credited to the shop", async ({ page }) => {
    await createProfile(page);
    const card = await bringToTop(page, (c) => c.videos.length > 0);
    await expect(topCard(page).getByTestId("video-chip")).toBeVisible();
    await expect(topCard(page).getByTestId("tap-hint")).toContainText("video");
    await page.keyboard.press("Enter");
    await page.getByTestId("detail-tab-video").click();
    const video = page.getByTestId("detail-video").locator("video");
    await expect(video).toHaveAttribute("src", card.videos[0]!.url);
    await expect(page.getByTestId("detail-video")).toContainText(`Video: ${card.retailer}`);
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted && v.loop && v.hasAttribute("playsinline"))).toBe(true);
  });
});
