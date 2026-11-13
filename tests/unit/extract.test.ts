import { describe, expect, it } from "vitest";
import { extractAttributes, stripHtml } from "@/sources/extract";

describe("extractAttributes", () => {
  it("reads a modern listing with structured description lines", () => {
    const a = extractAttributes({
      title: "3.72 Oval Lab Diamond in Whisper Thin® Hidden Halo",
      tags: ["14k Yellow Gold", "3-4 Carats", "bridal", "Hidden Halo"],
      productType: "Lab Grown Engagement Rings",
      body: "<p>Lab Grown Diamond Details:</p><p>Shape: Oval<br>Carat: 3.72<br>Color: F<br>Clarity: VS1<br>Certification: IGI</p>",
    });
    expect(a).toMatchObject({
      shape: "Oval",
      setting: "Hidden Halo",
      metal: "Yellow Gold",
      origin: "Lab-grown",
      centerStone: "Diamond",
      caratWeight: 3.72,
      color: "F",
      clarity: "VS1",
    });
  });

  it("reads a vintage listing written as prose, incl. two-tone metal", () => {
    const a = extractAttributes({
      title: "Edwardian GIA diamond 14k yellow gold silver bezel set engagement ring",
      tags: ["14k Gold", "Antique", "Diamond", "Edwardian", "Engagement Rings", "GIA", "Old Mine"],
      body:
        "<p>Its 0.90 carat old mine brilliant cut diamond — GIA-graded J color, VS2 clarity — shows a soft cushion outline, " +
        "held in a gently twisted silver bezel.</p>",
    });
    expect(a).toMatchObject({
      shape: "Old Mine/Old European",
      setting: "Bezel",
      metal: "Two-tone",
      origin: "Natural",
      centerStone: "Diamond",
      caratWeight: 0.9,
      color: "J",
      clarity: "VS2",
    });
  });

  it("emerald as a shape vs. as a gemstone; sapphire centre stones; carat from a name like 'Tala 2.05'", () => {
    expect(extractAttributes({ title: "3.67 Emerald Lab Diamond in Whisper Thin®" })).toMatchObject({ shape: "Emerald", centerStone: "Diamond" });
    expect(extractAttributes({ title: "Art Deco emerald and diamond platinum ring" })).toMatchObject({ centerStone: "Other", setting: "Vintage/Milgrain", metal: "Platinum" });
    expect(extractAttributes({ title: "Oval sapphire three stone ring in white gold" })).toMatchObject({
      shape: "Oval",
      centerStone: "Sapphire",
      setting: "Three-Stone",
      metal: "White Gold",
    });
    expect(extractAttributes({ title: "Tala 2.05", tags: ["Old European", "platinum", "solitaire"] })).toMatchObject({
      caratWeight: 2.05,
      shape: "Old Mine/Old European",
      setting: "Solitaire",
      metal: "Platinum",
    });
  });

  it("prefers the centre stone's grade and reads 'D VS1' shorthand; prong rings default to solitaire", () => {
    expect(
      extractAttributes({
        title: "Tulum GIA 0.90 carat old mine cut diamond 18k yellow gold engagement ring",
        tags: ["Platinum", "Yellow Gold", "Old Mine"],
        body: "Twelve diamonds in F color and VS clarity sit under the center, which weighs 0.90 carat and is graded G in color with I1 clarity.",
      }),
    ).toMatchObject({ color: "G", metal: "Two-tone", caratWeight: 0.9 });
    expect(extractAttributes({ title: "Myla GIA 0.91 carat D VS1 old mine cut diamond 18k yellow gold ring" })).toMatchObject({ color: "D", clarity: "VS1" });
    expect(extractAttributes({ title: "East West Prong GIA 1.51 carat old mine cut diamond 18k yellow gold ring" }).setting).toBe("Solitaire");
  });

  it("leaves unknowns as null and ignores out-of-range numbers", () => {
    const a = extractAttributes({ title: "The Heirloom", body: "Size 6. Weighs 22 carats of love." });
    expect(a.shape).toBeNull();
    expect(a.caratWeight).toBeNull(); // 22 ct is outside the taxonomy's carat range
    expect(a.metal).toBeNull();
  });

  it("strips html safely", () => {
    expect(stripHtml("<p>a&nbsp;b<br>c</p><script>x()</script>")).toBe("a b\nc");
  });
});
