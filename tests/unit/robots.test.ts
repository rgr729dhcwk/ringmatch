import { describe, expect, it } from "vitest";
import { isAllowed, parseRobots } from "@/sources/robots";

const txt = `
User-agent: *
Disallow: /checkout
Disallow: /collections/*sort_by*
Disallow: /recommendations/products
Allow: /checkout/thanks$

User-agent: GPTBot
User-agent: RingMatchBot
Disallow: /secret

User-agent: AhrefsBot
Disallow: /
`;
const r = parseRobots(txt);

describe("robots.txt", () => {
  it("applies the * group to unknown bots", () => {
    expect(isAllowed(r, "SomeBot/1.0", "/products.json?limit=250&page=1")).toBe(true);
    expect(isAllowed(r, "SomeBot/1.0", "/checkout/step1")).toBe(false);
    expect(isAllowed(r, "SomeBot/1.0", "/collections/rings?sort_by=price")).toBe(false);
    expect(isAllowed(r, "SomeBot/1.0", "/recommendations/products?x=1")).toBe(false);
  });

  it("longest rule wins, Allow wins ties, $ anchors", () => {
    expect(isAllowed(r, "SomeBot", "/checkout/thanks")).toBe(true);
    expect(isAllowed(r, "SomeBot", "/checkout/thanks/more")).toBe(false);
  });

  it("a group naming our bot replaces the * group", () => {
    expect(isAllowed(r, "RingMatchBot/0.1", "/checkout")).toBe(true);
    expect(isAllowed(r, "RingMatchBot/0.1", "/secret/x")).toBe(false);
  });

  it("Disallow: / blocks everything for that bot; empty robots allows all", () => {
    expect(isAllowed(r, "AhrefsBot", "/products.json")).toBe(false);
    expect(isAllowed(parseRobots(""), "RingMatchBot", "/anything")).toBe(true);
  });
});
