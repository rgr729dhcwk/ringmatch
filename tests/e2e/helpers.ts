import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const PROCEDURAL_BADGE = "Style preview — illustrative render";

/**
 * Creates a profile and gets through onboarding. With `chips` (data-testids like "chip-shapes-Oval")
 * those answers are picked and submitted; otherwise onboarding is skipped.
 */
/**
 * Retailer photos live on the shops' image servers (Shopify's CDN). Tests serve a local stand-in so
 * they never depend on someone else's servers; the real app always loads the real photos.
 */
const STAND_IN = readFileSync(path.join(process.cwd(), "public", "seed", "cad-oval-pave-rose-gold.jpg"));
export async function serveShopPhotosLocally(page: Page) {
  await page.context().route(/^https:\/\/(cdn\.shopify\.com|[a-z0-9.-]+\.myshopify\.com)\//, (route) =>
    /\.(mp4|m3u8)(\?|$)/.test(route.request().url())
      ? route.fulfill({ status: 200, contentType: "video/mp4", body: Buffer.alloc(0) })
      : route.fulfill({ status: 200, contentType: "image/jpeg", body: STAND_IN }),
  );
}

export async function createProfile(page: Page, name = `Tester ${Date.now()}`, chips?: string[]) {
  await serveShopPhotosLocally(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/profiles/);
  await page.fill("#displayName", name);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("onboarding")).toBeVisible();
  if (chips) {
    for (const c of chips) await page.getByTestId(c).click();
    await page.getByTestId("onboarding-submit").click();
  } else {
    await page.getByTestId("onboarding-skip").click();
  }
  await expect(page.getByTestId("deck")).toBeVisible();
  await expect(page.getByTestId("profile-name")).toHaveText(name);
}

export const deck = (page: Page) => page.getByTestId("deck");
export const topCard = (page: Page) => page.getByTestId("top-card");

/** Asserts the top card shows a real visual: a loaded <img>, or a rendered canvas + the badge. */
export async function expectTopCardVisual(page: Page): Promise<"image" | "procedural"> {
  const visual = topCard(page).getByTestId("card-visual");
  await expect(visual).toBeVisible();
  const kind = (await visual.getAttribute("data-visual-kind")) as "image" | "procedural" | null;
  expect(kind, "card has no visual kind").not.toBeNull();
  if (kind === "image") {
    const img = visual.getByTestId("card-image");
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), { timeout: 20_000 })
      .toBeGreaterThan(0);
  } else {
    await expect(visual).toHaveAttribute("data-rendered", "true", { timeout: 45_000 });
    const mode = await visual.getAttribute("data-render-mode");
    if (mode === "webgl") {
      const canvas = visual.locator("canvas");
      await expect(canvas).toBeVisible();
      const size = await canvas.evaluate((c: HTMLCanvasElement) => c.width * c.height);
      expect(size).toBeGreaterThan(0);
    } else {
      await expect(visual.getByTestId("ring-sketch")).toBeVisible();
    }
    await expect(visual.getByTestId("procedural-badge")).toHaveText(PROCEDURAL_BADGE);
  }
  return kind!;
}

export async function waitForSaves(page: Page) {
  await expect(deck(page)).toHaveAttribute("data-pending", "0");
  await expect(deck(page)).toHaveAttribute("data-refreshing", "0");
}

type Interaction = { id: string; listingId: string; action: string; undoesId: string | null };

export async function interactions(page: Page): Promise<Interaction[]> {
  await waitForSaves(page);
  const res = await page.request.get("/api/interactions");
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { interactions: Interaction[] }).interactions;
}

/** Drag the top card by (dx, dy) with a real pointer. */
export async function dragTopCard(page: Page, dx: number, dy: number) {
  const box = await topCard(page).boundingBox();
  if (!box) throw new Error("no top card");
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.35;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

export async function topCardId(page: Page) {
  return topCard(page).getAttribute("data-card-id");
}

/** Waits until the top card changes away from `id`. */
export async function expectNewTopCard(page: Page, id: string | null) {
  await expect.poll(() => topCardId(page)).not.toBe(id);
}
