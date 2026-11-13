import { expect, test, type Browser, type Page } from "@playwright/test";
import { createProfile, expectNewTopCard, topCardId, waitForSaves } from "./helpers";

// Partner mode is about two people's lists, not 3D.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-3d-apis"] } });

type DeckCard = { id: string; title: string; explore?: boolean; why?: string; specs: { label: string; value: string }[] };

/** A second person = a separate browser context (their own cookies, like their own phone). */
async function person(browser: Browser, name: string, use: Parameters<typeof test.use>[0] = {}): Promise<Page> {
  const ctx = await browser.newContext(use as object);
  const page = await ctx.newPage();
  await createProfile(page, name);
  return page;
}

async function link(a: Page, b: Page) {
  await a.getByTestId("nav-partner").click();
  await a.getByTestId("create-invite").click();
  const code = (await a.getByTestId("invite-code").innerText()).trim();
  await b.getByTestId("nav-partner").click();
  // Typed casually: lower case, no dash.
  await b.getByTestId("join-code").fill(code.toLowerCase().replace("-", " "));
  await b.getByTestId("join").click();
  await expect(b.getByTestId("joined")).toBeVisible();
  return code;
}

const swipeApi = (p: Page, listingId: string, action: string) =>
  p.request.post("/api/interactions", { data: { listingId, action } }).then(async (r) => {
    expect(r.ok()).toBe(true);
    return r.json() as Promise<{ id: string; match: { partnerName: string } | null }>;
  });

test.describe("Milestone 5: partner mode", () => {
  test("invite by code, join, wrong codes explained, and leave", async ({ page: alex, browser }) => {
    await createProfile(alex, "Alex");
    const sam = await person(browser, "Sam");

    // Bad codes are explained.
    await sam.getByTestId("nav-partner").click();
    await sam.getByTestId("join-code").fill("hello");
    await sam.getByTestId("join").click();
    await expect(sam.getByTestId("partner-error")).toContainText("doesn't look like an invite code");
    await sam.getByTestId("join-code").fill("ABC-DEF");
    await sam.getByTestId("join").click();
    await expect(sam.getByTestId("partner-error")).toContainText("No invite found");

    await alex.getByTestId("nav-partner").click();
    await alex.getByTestId("create-invite").click();
    const code = (await alex.getByTestId("invite-code").innerText()).trim();
    expect(code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    await expect(alex.getByTestId("waiting")).toBeVisible();
    // Alex can't join their own code.
    await alex.getByTestId("join-code").fill(code);
    await alex.getByTestId("join").click();
    await expect(alex.getByTestId("partner-error")).toContainText("your own invite code");

    await sam.goto(`/partner?code=${code}`); // the shared link pre-fills the code
    await expect(sam.getByTestId("join-code")).toHaveValue(code);
    await sam.getByTestId("join").click();
    await expect(sam.getByTestId("joined")).toContainText("Alex");
    await expect(sam.getByRole("heading", { level: 1 })).toHaveText("You & Alex");
    await alex.reload();
    await expect(alex.getByRole("heading", { level: 1 })).toHaveText("You & Sam");

    // A third person can't use the same code.
    const kim = await person(browser, "Kim");
    await kim.goto(`/partner?code=${code}`);
    await kim.getByTestId("join").click();
    await expect(kim.getByTestId("partner-error")).toContainText("already been used");

    await sam.getByTestId("leave").click();
    await expect(sam.getByTestId("create-invite")).toBeVisible();
    await alex.reload();
    await expect(alex.getByTestId("create-invite")).toBeVisible();
  });

  test("liking the same ring is a match: pop-up for the second swiper, listed for both", async ({ page: alex, browser }) => {
    await createProfile(alex, "Alex");
    const sam = await person(browser, "Sam");
    await link(alex, sam);
    await alex.goto("/");
    const ring = (await topCardId(alex))!;
    expect((await swipeApi(sam, ring, "revisit")).match).toBeNull(); // Alex hasn't swiped it yet
    await alex.keyboard.press("ArrowUp"); // love
    await expect(alex.getByTestId("match-toast")).toContainText("Sam likes");
    await expectNewTopCard(alex, ring);
    await waitForSaves(alex);
    // A dislike is never a match.
    const other = (await topCardId(alex))!;
    await swipeApi(sam, other, "like");
    expect((await swipeApi(alex, other, "dislike")).match).toBeNull();

    for (const [p, partner, mine] of [
      [alex, "Sam", "You love it"],
      [sam, "Alex", "You saved it"],
    ] as const) {
      await p.goto("/partner");
      const m = p.getByTestId("match");
      await expect(m).toHaveCount(1);
      await expect(m).toHaveAttribute("data-listing-id", ring);
      await expect(m).toContainText(mine);
      await expect(m).toContainText(partner);
    }
  });

  test("surprise mode hides one partner's swipes, in one direction only", async ({ page: alex, browser }) => {
    await createProfile(alex, "Alex");
    const sam = await person(browser, "Sam");
    await link(alex, sam);
    await alex.goto("/");
    const ring = (await topCardId(alex))!;
    await swipeApi(alex, ring, "love");
    for (const id of [ring]) await swipeApi(sam, id, "love");

    // Sam turns surprise mode on (Sam is planning a surprise).
    await sam.goto("/partner");
    await sam.getByTestId("toggle-surprise").click();
    await expect(sam.getByTestId("surprise-state")).toContainText("On");

    // Alex can no longer see anything of Sam's.
    await alex.goto("/partner");
    await expect(alex.getByTestId("partner-hidden")).toBeVisible();
    await expect(alex.getByTestId("match")).toHaveCount(0);
    await expect(alex.getByTestId("partner-taste")).toHaveCount(0);
    await expect(alex.getByTestId("blend-slider")).toHaveCount(0);
    // …and gets no match alerts from Sam's likes.
    const { cards } = (await (await alex.request.get("/api/deck")).json()) as { cards: DeckCard[] };
    const next = cards[0]!.id;
    await swipeApi(sam, next, "love");
    expect((await swipeApi(alex, next, "love")).match).toBeNull();
    // Alex's deck doesn't mention Sam.
    const after = (await (await alex.request.get("/api/deck")).json()) as { cards: DeckCard[] };
    expect(after.cards.some((c) => c.why?.includes("Sam"))).toBe(false);

    // Sam still sees Alex's matches and taste.
    await sam.reload();
    await expect(sam.getByTestId("match")).toHaveCount(2);
    await expect(sam.getByTestId("partner-taste")).toBeVisible();
    expect((await swipeApi(sam, cards[1]!.id, "like")).match).toBeNull(); // Alex hasn't swiped that one

    // Turning it off restores Alex's view.
    await sam.getByTestId("toggle-surprise").click();
    await alex.reload();
    await expect(alex.getByTestId("match")).toHaveCount(2);
  });

  test("the blend slider steers both decks toward a partner's taste, and reasons name them", async ({ page: alex, browser }) => {
    await createProfile(alex, "Alex");
    const sam = await person(browser, "Sam");
    await link(alex, sam);
    // Sam loves several rings of one shape.
    const { cards } = (await (await sam.request.get("/api/deck")).json()) as { cards: DeckCard[] };
    const shapeOf = (c: DeckCard) => c.specs.find((s) => s.label === "Shape")?.value;
    const counts = new Map<string, number>();
    for (const c of cards) if (shapeOf(c)) counts.set(shapeOf(c)!, (counts.get(shapeOf(c)!) ?? 0) + 1);
    const shape = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    for (const c of cards.filter((x) => shapeOf(x) === shape).slice(0, 4)) await swipeApi(sam, c.id, "love");

    // Alex hands the deck entirely to Sam's taste.
    await alex.goto("/partner");
    const slider = alex.getByTestId("blend-slider");
    await slider.focus();
    await alex.keyboard.press("Home");
    await expect(alex.getByTestId("blend-label")).toHaveAttribute("data-saved", "1");
    await expect(alex.getByTestId("blend-label")).toContainText("Mostly Sam's taste");
    // Sam sees the same blend from their side.
    await sam.goto("/partner");
    await expect(sam.getByTestId("blend-label")).toContainText("Mostly my taste");

    const deck = (await (await alex.request.get("/api/deck")).json()) as { cards: DeckCard[] };
    const pick = deck.cards.find((c) => !c.explore)!;
    expect(shapeOf(pick)).toBe(shape);
    expect(pick.why).toMatch(/^Because Sam liked/);
  });
});
