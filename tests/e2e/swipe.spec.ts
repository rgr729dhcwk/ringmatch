import { expect, test } from "@playwright/test";
import { createProfile, deck, dragTopCard, expectNewTopCard, expectTopCardVisual, interactions, topCardId, waitForSaves } from "./helpers";

test.describe("swiping", () => {
  test.beforeEach(async ({ page }) => {
    await createProfile(page);
    await expectTopCardVisual(page);
  });

  test("drag right = like, drag left = dislike, drag up = love", async ({ page }) => {
    const a = await topCardId(page);
    await dragTopCard(page, 260, 10);
    await expectNewTopCard(page, a);
    await expect(deck(page)).toHaveAttribute("data-last-action", "like");

    const b = await topCardId(page);
    await dragTopCard(page, -260, 10);
    await expectNewTopCard(page, b);
    await expect(deck(page)).toHaveAttribute("data-last-action", "dislike");

    const c = await topCardId(page);
    await dragTopCard(page, 0, -300);
    await expectNewTopCard(page, c);
    await expect(deck(page)).toHaveAttribute("data-last-action", "love");

    const rows = await interactions(page);
    expect(rows.map((r) => [r.listingId, r.action]).reverse()).toEqual([
      [a, "like"],
      [b, "dislike"],
      [c, "love"],
    ]);
  });

  test("a short drag snaps back and records nothing", async ({ page }) => {
    const a = await topCardId(page);
    await dragTopCard(page, 40, 0);
    await page.waitForTimeout(600);
    expect(await topCardId(page)).toBe(a);
    await expect(page.getByTestId("card-detail")).toHaveCount(0); // a drag is not a tap
    expect(await interactions(page)).toHaveLength(0);
  });

  test("keyboard: ← dislike, → like, ↑ love, S revisit", async ({ page }) => {
    const expected: [string | null, string][] = [];
    for (const [key, action] of [
      ["ArrowLeft", "dislike"],
      ["ArrowRight", "like"],
      ["ArrowUp", "love"],
      ["ArrowDown", "strong_dislike"],
      ["s", "revisit"],
    ] as const) {
      const id = await topCardId(page);
      await page.keyboard.press(key);
      await expectNewTopCard(page, id);
      await expect(deck(page)).toHaveAttribute("data-last-action", action);
      expected.push([id, action]);
    }
    const rows = await interactions(page);
    expect(rows.map((r) => [r.listingId, r.action]).reverse()).toEqual(expected);
  });

  test("buttons: love it and revisit later", async ({ page }) => {
    const a = await topCardId(page);
    await page.getByTestId("action-love").click();
    await expectNewTopCard(page, a);
    const b = await topCardId(page);
    await page.getByTestId("action-revisit").click();
    await expectNewTopCard(page, b);
    const c = await topCardId(page);
    await page.getByTestId("action-like").click();
    await expectNewTopCard(page, c);
    const d = await topCardId(page);
    await page.getByTestId("action-dislike").click();
    await expectNewTopCard(page, d);
    const rows = await interactions(page);
    expect(rows.map((r) => [r.listingId, r.action]).reverse()).toEqual([
      [a, "love"],
      [b, "revisit"],
      [c, "like"],
      [d, "dislike"],
    ]);
  });

  test("undo brings the card back and records an undo row (button, Z and Backspace)", async ({ page }) => {
    await expect(page.getByTestId("action-undo")).toBeDisabled();
    const a = await topCardId(page);
    await page.keyboard.press("ArrowRight");
    await expectNewTopCard(page, a);
    await page.getByTestId("action-undo").click();
    await expect.poll(() => topCardId(page)).toBe(a);
    await expectTopCardVisual(page);

    await page.keyboard.press("ArrowUp");
    await expectNewTopCard(page, a);
    await page.keyboard.press("z");
    await expect.poll(() => topCardId(page)).toBe(a);

    await page.keyboard.press("s");
    await expectNewTopCard(page, a);
    await page.keyboard.press("Backspace");
    await expect.poll(() => topCardId(page)).toBe(a);
    await waitForSaves(page);

    const rows = (await interactions(page)).reverse();
    expect(rows.map((r) => r.action)).toEqual(["like", "undo", "love", "undo", "revisit", "undo"]);
    for (let i = 1; i < rows.length; i += 2) expect(rows[i]!.undoesId).toBe(rows[i - 1]!.id);
    expect(rows.every((r) => r.listingId === a)).toBe(true);

    // After a reload the card is still unseen (undo really cancelled the swipe).
    const { listings } = await (await page.request.get("/api/health")).json();
    await page.reload();
    await expect(deck(page)).toHaveAttribute("data-remaining", String(listings));
  });

  test("swipes persist: a reload does not show already-swiped cards", async ({ page }) => {
    const a = await topCardId(page);
    await page.keyboard.press("ArrowLeft");
    await expectNewTopCard(page, a);
    await waitForSaves(page);
    const before = Number(await deck(page).getAttribute("data-remaining"));
    await page.reload();
    await expect(deck(page)).toHaveAttribute("data-remaining", String(before));
    expect(await topCardId(page)).not.toBe(a);
  });
});
