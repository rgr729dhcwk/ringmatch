/**
 * Reads ring attributes out of retailer text (title, tags, product type, description).
 * All vocabulary comes from TEXT_SYNONYMS in src/lib/taxonomy.ts. Pure — no network.
 * Unknown stays null: the card simply doesn't show that detail, and the 3D preview uses a default.
 */
import { BAND_WIDTH_BOUNDS, CARAT_BOUNDS, CLARITIES, COLORS, TEXT_SYNONYMS } from "@/lib/taxonomy";
import type { ListingAttributes } from "@/lib/listing";

export type ProductText = { title: string; tags?: string[]; productType?: string | null; body?: string | null };

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|div|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .trim();
}

type Groups = readonly (readonly [string, readonly string[]])[];

/** First group (in priority order) with a phrase present in the text. */
function firstMatch<T extends string>(groups: Groups, text: string): T | null {
  for (const [value, phrases] of groups) {
    if (phrases.some((p) => text.includes(p))) return value as T;
  }
  return null;
}

/** "Shape: Oval", "Carat: 3.72" style lines in descriptions. */
function structuredFields(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /\b(shape|carat(?: weight)?|colou?r|clarity|cut|metal|setting)\s*:\s*([^\n|;]{1,40})/gi;
  for (const m of body.matchAll(re)) {
    const key = m[1]!.toLowerCase().replace("colour", "color").replace("carat weight", "carat");
    if (!(key in out)) out[key] = m[2]!.trim();
  }
  return out;
}

const inRange = (n: number, b: { min: number; max: number }) => (Number.isFinite(n) && n >= b.min && n <= b.max ? n : null);

function caratFrom(title: string, structured: string | undefined, body: string): number | null {
  const tries: (string | undefined)[] = [
    structured?.match(/(\d+(?:\.\d+)?)/)?.[1],
    title.match(/(\d+(?:\.\d+)?)\s*(?:ct\b|cttw\b|carats?\b|-carat\b)/i)?.[1],
    title.match(/^(\d\.\d{1,2})\s/)?.[1], // "3.72 Oval Lab Diamond…"
    title.match(/\b(\d\.\d{2})\b/)?.[1], // "Tala 2.05"
    body.match(/(\d+(?:\.\d+)?)\s*(?:ct\b|carats?\b|-carat\b)/i)?.[1],
  ];
  for (const t of tries) {
    if (!t) continue;
    const n = inRange(Number(t), CARAT_BOUNDS);
    if (n != null) return n;
  }
  return null;
}

function colorFrom(structured: string | undefined, text: string): ListingAttributes["color"] {
  const clarity = CLARITIES.join("|");
  const letter =
    structured?.trim().match(/^([D-Z])\b/)?.[1] ??
    // "graded G in color" — how descriptions usually state the centre stone's grade.
    text.match(/\bgraded\s+([D-M])\s+(?:in\s+)?colou?r\b/i)?.[1]?.toUpperCase() ??
    // "… D VS1 old mine cut …"
    text.match(new RegExp(`\\b([D-M])\\s+(?:${clarity})\\b`))?.[1] ??
    text.match(/\b([D-M])(?:\s*[-–\/]\s*[D-M])?\s+colou?r\b/)?.[1] ??
    text.match(/\bcolou?r\s*(?:grade)?\s*:?\s*([D-M])\b/i)?.[1]?.toUpperCase();
  return letter && (COLORS as readonly string[]).includes(letter) ? (letter as ListingAttributes["color"]) : null;
}

function clarityFrom(structured: string | undefined, text: string): ListingAttributes["clarity"] {
  const pattern = new RegExp(`\\b(${[...CLARITIES].sort((a, b) => b.length - a.length).join("|")})\\b`);
  const v = structured?.toUpperCase().match(pattern)?.[1] ?? text.match(pattern)?.[1];
  return (v as ListingAttributes["clarity"]) ?? null;
}

function bandWidthFrom(text: string): number | null {
  const m = text.match(/(\d(?:\.\d)?)\s*mm\s*(?:wide\s*)?(?:band|shank)/i) ?? text.match(/band(?: width)?\s*:?\s*(\d(?:\.\d)?)\s*mm/i);
  return m ? inRange(Number(m[1]), BAND_WIDTH_BOUNDS) : null;
}

export function extractAttributes(p: ProductText): ListingAttributes {
  const title = p.title ?? "";
  const tags = p.tags ?? [];
  const primary = ` ${[title, tags.join(" | "), p.productType ?? ""].join(" | ").toLowerCase()} `;
  const bodyRaw = p.body ? stripHtml(p.body).slice(0, 6000) : "";
  const body = ` ${bodyRaw.toLowerCase()} `;
  const s = structuredFields(bodyRaw);
  const all = `${primary} ${body}`;

  const shape =
    (s.shape ? firstMatch(TEXT_SYNONYMS.shape, ` ${s.shape.toLowerCase()} `) : null) ??
    firstMatch(TEXT_SYNONYMS.shape, primary) ??
    firstMatch(TEXT_SYNONYMS.shape, body);

  // Two-tone: white metal (silver/platinum) together with yellow gold in the title/tags.
  const twoTone = /(silver|platinum)/.test(primary) && /(yellow gold|\b1[048]k gold|\b22k gold)/.test(primary);
  const metal = twoTone
    ? "Two-tone"
    : (firstMatch(TEXT_SYNONYMS.metal, primary) ?? (s.metal ? firstMatch(TEXT_SYNONYMS.metal, s.metal.toLowerCase()) : null) ?? firstMatch(TEXT_SYNONYMS.metal, body));

  return {
    shape: shape as ListingAttributes["shape"],
    setting: (firstMatch(TEXT_SYNONYMS.setting, primary) ??
      firstMatch(TEXT_SYNONYMS.setting, body) ??
      // A prong-set ring with no other setting named is a solitaire.
      (/\bprongs?\b|\bclaws?\b/.test(primary) ? "Solitaire" : null)) as ListingAttributes["setting"],
    metal: metal as ListingAttributes["metal"],
    prongs: (firstMatch(TEXT_SYNONYMS.prongs, primary) ?? firstMatch(TEXT_SYNONYMS.prongs, body)) as ListingAttributes["prongs"],
    centerStone: (firstMatch(TEXT_SYNONYMS.centerStone, ` ${title.toLowerCase()} `) ??
      firstMatch(TEXT_SYNONYMS.centerStone, primary)) as ListingAttributes["centerStone"],
    origin: (firstMatch(TEXT_SYNONYMS.origin, primary) ?? firstMatch(TEXT_SYNONYMS.origin, body)) as ListingAttributes["origin"],
    cut: (firstMatch(TEXT_SYNONYMS.cut, all) ?? null) as ListingAttributes["cut"],
    caratWeight: caratFrom(title, s.carat, bodyRaw),
    color: colorFrom(s.color, `${title} ${bodyRaw}`),
    clarity: clarityFrom(s.clarity, `${title} ${bodyRaw}`),
    bandWidthMm: bandWidthFrom(`${title} ${bodyRaw}`),
    bandStyle: (firstMatch(TEXT_SYNONYMS.bandStyle, all) ?? null) as ListingAttributes["bandStyle"],
    bandProfile: (firstMatch(TEXT_SYNONYMS.bandProfile, all) ?? null) as ListingAttributes["bandProfile"],
  };
}
