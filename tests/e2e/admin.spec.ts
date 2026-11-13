import { expect, test, type Page } from "@playwright/test";
import { createProfile, deck, topCard, topCardId } from "./helpers";

// Admin is about forms and lists, not 3D.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-3d-apis"] } });

const PASSWORD = "e2e-admin-password";
const LOCAL_PHOTO = "/seed/cad-oval-pave-rose-gold.jpg"; // a real 1060px image served by the app
const BROKEN_PHOTO = "https://images.example.invalid/ring.jpg"; // remote checks are offline in e2e → skipped

async function login(page: Page) {
  await page.goto("/admin");
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("admin")).toBeVisible();
}

async function addListing(page: Page, fields: Record<string, string>) {
  await page.goto("/admin/listings/new");
  for (const [k, v] of Object.entries(fields)) {
    const el = page.getByTestId(`field-${k}`);
    if ((await el.evaluate((e) => e.tagName)) === "SELECT") await el.selectOption(v);
    else await el.fill(v);
  }
  await page.getByTestId("save-listing").click();
  const result = page.getByTestId("save-result");
  await expect(result).toBeVisible({ timeout: 30_000 });
  return result;
}

const unique = () => Math.random().toString(36).slice(2, 8);

test.describe("Milestone 4: real listings via admin", () => {
  test("wrong password is refused; non-admins can't reach admin pages or the export", async ({ page }) => {
    await page.goto("/admin");
    await page.fill("#password", "not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByTestId("admin-login-error")).toBeVisible();
    expect((await page.request.get("/api/admin/export")).status()).toBe(401);
    await page.goto("/admin/listings/new");
    await expect(page.getByTestId("admin-login")).toBeVisible();
  });

  test("a real listing with a good photo is saved, bad photos are skipped with a reason, and it shows on the deck with its shop link", async ({ page }) => {
    await login(page);
    const title = `Real oval halo ${unique()}`;
    const result = await addListing(page, {
      title,
      retailer: "Example Jewellers",
      sourceUrl: "https://shop.example.com/rings/oval-halo",
      price: "4,250",
      images: `${BROKEN_PHOTO}\n${LOCAL_PHOTO}`,
      shape: "Oval",
      caratWeight: "1.2",
      setting: "Halo",
      metal: "Rose Gold",
    });
    await expect(result).toHaveAttribute("data-outcome", "accepted");
    await expect(result).toContainText("1 photo passed the check");
    await expect(page.getByTestId("image-failures")).toContainText("offline mode");

    // On the deck: a profile walks the deck until the real ring is on top.
    const { cards } = await (async () => {
      await createProfile(page, "Shopper");
      return (await page.request.get("/api/deck")).json() as Promise<{ cards: { id: string; title: string }[] }>;
    })();
    const real = cards.find((c) => c.title === title);
    expect(real, "real listing should be in the deck").toBeTruthy();
    for (let i = 0; i < cards.length && (await topCardId(page)) !== real!.id; i++) {
      const before = await deck(page).getAttribute("data-index");
      await page.keyboard.press("ArrowRight");
      await expect(deck(page)).not.toHaveAttribute("data-index", before!);
    }
    expect(await topCardId(page)).toBe(real!.id);
    const card = topCard(page);
    await expect(card.getByTestId("card-visual")).toHaveAttribute("data-visual-kind", "image");
    await expect.poll(() => card.getByTestId("card-image").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    await expect(card.getByTestId("card-retailer")).toHaveText("Example Jewellers");
    await expect(card.getByRole("link", { name: /View listing/ })).toHaveAttribute("href", "https://shop.example.com/rings/oval-halo");
    await expect(card.getByTestId("sample-label")).toHaveCount(0);
    await expect(card.getByTestId("card-price")).toHaveText("$4,250");
  });

  test("no usable photo → 3D style preview; nothing to draw → rejected, and the form keeps what was typed", async ({ page }) => {
    await login(page);
    const fallback = await addListing(page, {
      title: `Pear solitaire ${unique()}`,
      retailer: "Example Jewellers",
      sourceUrl: "https://shop.example.com/rings/pear",
      images: BROKEN_PHOTO,
      shape: "Pear",
    });
    await expect(fallback).toHaveAttribute("data-outcome", "fell_back_procedural");
    await expect(fallback).toContainText("illustrative 3D render");

    const title = `Mystery ring ${unique()}`;
    const rejected = await addListing(page, {
      title,
      retailer: "Example Jewellers",
      sourceUrl: "https://shop.example.com/rings/mystery",
      metal: "Platinum",
    });
    await expect(rejected).toHaveAttribute("data-outcome", "rejected");
    await expect(rejected).toContainText("not enough attributes");
    await expect(page.getByTestId("field-title")).toHaveValue(title);
  });

  test("edit, hide/show, export and import", async ({ page }) => {
    await login(page);
    const title = `Emerald three-stone ${unique()}`;
    await addListing(page, {
      title,
      retailer: "Another Shop",
      sourceUrl: "https://another.example.com/p/1",
      price: "9000",
      images: LOCAL_PHOTO,
      shape: "Emerald",
      setting: "Three-Stone",
    });

    // Edit the price.
    await page.goto("/admin");
    const row = page.getByTestId("admin-listing").filter({ hasText: title });
    const id = await row.getAttribute("data-listing-id");
    await row.getByTestId("edit-listing").click();
    await expect(page.getByTestId("field-price")).toHaveValue("9000");
    await page.getByTestId("field-price").fill("8500");
    await page.getByTestId("save-listing").click();
    await expect(page.getByTestId("save-result")).toHaveAttribute("data-outcome", "accepted");
    await page.goto("/admin");
    await expect(row).toContainText("$8,500");

    // Hide → gone from the app; Show → back.
    const inDeck = async () => {
      const r = await page.request.get("/api/health");
      return (await r.json()).listings as number;
    };
    const before = await inDeck();
    await row.getByTestId("toggle-active").click();
    await expect(row).toHaveAttribute("data-active", "0");
    expect(await inDeck()).toBe(before - 1);
    await row.getByTestId("toggle-active").click();
    await expect(row).toHaveAttribute("data-active", "1");
    expect(await inDeck()).toBe(before);

    // Export contains it; importing a copy (new id + title) adds one more.
    // Fetched by the page itself (as the download link would be): the admin cookie is Secure-only.
    const exported = await page.evaluate(() => fetch("/api/admin/export").then((r) => r.json()));
    const mine = exported.listings.find((l: { title: string }) => l.title === title);
    expect(mine).toMatchObject({ retailer: "Another Shop", price: 8500, shape: "Emerald", sourceUrl: "https://another.example.com/p/1" });
    expect(mine.images).toEqual([{ url: LOCAL_PHOTO, kind: "photo" }]);
    const copyTitle = `${title} (copy)`;
    await page.getByTestId("import-json").fill(JSON.stringify({ listings: [{ ...mine, externalId: `copy-${unique()}`, title: copyTitle }] }));
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.getByTestId("import-result")).toContainText("Imported 1 of 1");
    await page.goto("/admin");
    await expect(page.getByTestId("admin-listing").filter({ hasText: copyTitle })).toHaveCount(1);
    expect(id).toBeTruthy();
  });
});
