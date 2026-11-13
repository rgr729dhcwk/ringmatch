import { expect, test } from "@playwright/test";
import { createProfile, deck, expectNewTopCard, expectTopCardVisual, topCard, topCardId, waitForSaves } from "./helpers";

type DeckCard = { id: string; title: string; why?: string; explore?: boolean };

test.describe("Milestone 2: onboarding, recommendations, taste", () => {
  test("onboarding starts on 'show me everything' for every question", async ({ page }) => {
    await page.goto("/profiles");
    await page.fill("#displayName", "Fresh");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByTestId("onboarding")).toBeVisible();
    for (const key of ["shapes", "metals", "settings", "centerStones", "origin", "budget", "carat"]) {
      await expect(page.getByTestId(`chip-${key}-any`), key).toHaveAttribute("aria-pressed", "true");
    }
    // Picking a value turns "not sure" off; un-picking it turns "not sure" back on.
    await page.getByTestId("chip-shapes-Oval").click();
    await expect(page.getByTestId("chip-shapes-any")).toHaveAttribute("aria-pressed", "false");
    await page.getByTestId("chip-shapes-Oval").click();
    await expect(page.getByTestId("chip-shapes-any")).toHaveAttribute("aria-pressed", "true");
    // The optional extra questions also default to "show me everything".
    await page.getByRole("button", { name: /More details/ }).click();
    for (const key of ["colorGroups", "clarities", "cuts", "prongs", "bandStyles", "bandProfiles"]) {
      await expect(page.getByTestId(`chip-${key}-any`), key).toHaveAttribute("aria-pressed", "true");
    }
  });

  test("stated preferences shape the first cards and are explained", async ({ page }) => {
    await createProfile(page, "Oval fan", ["chip-shapes-Oval", "chip-metals-Rose Gold"]);
    await expectTopCardVisual(page);
    const taste = await (await page.request.get("/api/taste")).json();
    expect(taste.prefs.shapes).toEqual(["Oval"]);
    expect(taste.prefs.metals).toEqual(["Rose Gold"]);
    expect(taste.prefs.settings).toBe("any");

    const { cards } = (await (await page.request.get("/api/deck")).json()) as { cards: DeckCard[] };
    const firstPick = cards.find((c) => !c.explore)!;
    expect(firstPick.why).toMatch(/^Matches what you told us: .*(oval stones|rose gold)/);
    expect(cards.filter((c) => c.explore).length).toBeGreaterThan(0);

    const why = topCard(page).getByTestId("card-why");
    await expect(why).toBeVisible();
    await expect(why).not.toHaveText("");
  });

  test("skipping onboarding shows everything with a fresh-start line", async ({ page }) => {
    await createProfile(page);
    await expect(topCard(page).getByTestId("card-why")).toHaveText(/A fresh style to start you off/);
  });

  test("the deck learns from swipes", async ({ page }) => {
    await createProfile(page);
    await expectTopCardVisual(page);
    for (let i = 0; i < 3; i++) {
      const id = await topCardId(page);
      await page.keyboard.press("ArrowUp"); // love
      await expectNewTopCard(page, id);
    }
    await waitForSaves(page);
    const { cards } = (await (await page.request.get("/api/deck")).json()) as { cards: DeckCard[] };
    const firstPick = cards.find((c) => !c.explore)!;
    expect(firstPick.why).toMatch(/^Because you liked /);
    // The on-screen queue was re-ranked too: within the next few cards a learned reason shows up.
    let sawLearned = false;
    for (let i = 0; i < 6 && !sawLearned; i++) {
      const text = await topCard(page).getByTestId("card-why").innerText();
      sawLearned = /Because you liked/.test(text);
      if (!sawLearned) {
        const id = await topCardId(page);
        await page.keyboard.press("ArrowRight");
        await expectNewTopCard(page, id);
      }
    }
    expect(sawLearned).toBe(true);
  });

  test("taste page summarises swipes in plain words", async ({ page }) => {
    await createProfile(page);
    await expectTopCardVisual(page);
    await page.getByTestId("nav-taste").click();
    await expect(page.getByTestId("taste-summary")).toHaveText("Swipe 5 more rings to see your taste.");
    await page.getByTestId("back-to-deck").click();
    await expect(deck(page)).toBeVisible();
    for (const key of ["ArrowUp", "ArrowUp", "ArrowUp", "ArrowLeft", "ArrowLeft"]) {
      const id = await topCardId(page);
      await page.keyboard.press(key);
      await expectNewTopCard(page, id);
    }
    await waitForSaves(page);
    await page.getByTestId("nav-taste").click();
    await expect(page.getByTestId("taste-summary")).toHaveText(/You lean toward|No strong favourites/);
    await expect(page.getByTestId("count-love")).toHaveText("3");
    await expect(page.getByTestId("count-dislike")).toHaveText("2");
    await expect(page.getByTestId("count-like")).toHaveText("0");
  });

  test("preferences can be edited later", async ({ page }) => {
    await createProfile(page, "Editor", ["chip-metals-Platinum"]);
    await page.getByTestId("nav-prefs").click();
    await expect(page.getByTestId("chip-metals-Platinum")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("chip-settings-Halo").click();
    await page.getByTestId("onboarding-submit").click();
    await expect(deck(page)).toBeVisible();
    await page.getByTestId("nav-taste").click();
    await expect(page.getByTestId("stated-prefs")).toContainText("Platinum");
    await expect(page.getByTestId("stated-prefs")).toContainText("Halo");
  });
});
