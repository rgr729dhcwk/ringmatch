/**
 * RingMatch taxonomy — the SINGLE source of truth for every ring attribute value.
 * Do not define these lists anywhere else; import from here.
 */

/** Sentinel used by every preference field for "Not sure / show me everything". */
export const ANY = "any" as const;
export type Any = typeof ANY;
export const ANY_LABEL = "Not sure / show me everything";

export const SHAPES = [
  "Round",
  "Oval",
  "Cushion",
  "Emerald",
  "Princess",
  "Pear",
  "Marquise",
  "Radiant",
  "Asscher",
  "Heart",
  "Elongated Cushion",
  "Old Mine/Old European",
] as const;
export type Shape = (typeof SHAPES)[number];

export const CUTS = ["Ideal/Excellent", "Very Good", "Good", "Fair"] as const;
export type Cut = (typeof CUTS)[number];

export const COLORS = [
  "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P",
  "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
] as const;
export type Color = (typeof COLORS)[number];

export const COLOR_GROUPS = {
  Colorless: ["D", "E", "F"],
  "Near-colorless": ["G", "H", "I", "J"],
  Faint: ["K", "L", "M"],
} as const satisfies Record<string, readonly Color[]>;
export type ColorGroup = keyof typeof COLOR_GROUPS;

export function colorGroupOf(c: Color): ColorGroup | null {
  for (const [group, list] of Object.entries(COLOR_GROUPS) as [ColorGroup, readonly Color[]][]) {
    if (list.includes(c)) return group;
  }
  return null; // N–Z: outside the named groups
}

export const CLARITIES = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1", "I2", "I3"] as const;
export type Clarity = (typeof CLARITIES)[number];

export const CARAT_BOUNDS = { min: 0.25, max: 6, step: 0.05 } as const;

export const ORIGINS = ["Natural", "Lab-grown"] as const;
export type Origin = (typeof ORIGINS)[number];
/** Preference-only option; listings are either Natural or Lab-grown. */
export const ORIGIN_PREFERENCES = [...ORIGINS, "No preference"] as const;

export const CENTER_STONES = ["Diamond", "Moissanite", "Sapphire", "Other"] as const;
export type CenterStone = (typeof CENTER_STONES)[number];

export const SETTINGS = [
  "Solitaire",
  "Halo",
  "Hidden Halo",
  "Three-Stone",
  "Pavé",
  "Bezel",
  "Vintage/Milgrain",
  "Toi et Moi",
  "Cathedral",
  "Split Shank",
  "Cluster",
] as const;
export type Setting = (typeof SETTINGS)[number];

export const PRONGS = ["4", "6", "Claw", "Double", "Compass"] as const;
export type Prong = (typeof PRONGS)[number];
export const PRONG_LABELS: Record<Prong, string> = {
  "4": "4-prong",
  "6": "6-prong",
  Claw: "Claw",
  Double: "Double",
  Compass: "Compass (N-S-E-W)",
};

export const METALS = ["Yellow Gold", "White Gold", "Rose Gold", "Platinum", "Two-tone"] as const;
export type Metal = (typeof METALS)[number];

export const BAND_STYLES = ["Plain", "Pavé"] as const;
export type BandStyle = (typeof BAND_STYLES)[number];
export const BAND_PROFILES = ["Straight", "Tapered"] as const;
export type BandProfile = (typeof BAND_PROFILES)[number];
export const BAND_WIDTH_BOUNDS = { min: 1.2, max: 6, step: 0.1 } as const;

export const BUDGET_BOUNDS = { min: 0, max: 100_000, step: 250 } as const;

export const CURRENCIES = ["USD"] as const;

/** Defaults used when a listing omits an attribute that the procedural renderer needs. */
export const RENDER_DEFAULTS = {
  shape: "Round",
  caratWeight: 1,
  setting: "Solitaire",
  prongs: "4",
  metal: "White Gold",
  bandWidthMm: 2,
  bandStyle: "Plain",
  bandProfile: "Straight",
  centerStone: "Diamond",
} as const satisfies {
  shape: Shape;
  caratWeight: number;
  setting: Setting;
  prongs: Prong;
  metal: Metal;
  bandWidthMm: number;
  bandStyle: BandStyle;
  bandProfile: BandProfile;
  centerStone: CenterStone;
};

/**
 * Stated preferences (Milestone 2 onboarding). Every field defaults to ANY.
 * Defined here so the shape of preferences stays tied to the taxonomy.
 */
export type Range = { min: number; max: number };
export type StatedPrefs = {
  shapes: Shape[] | Any;
  cuts: Cut[] | Any;
  colorGroups: ColorGroup[] | Any;
  clarities: Clarity[] | Any;
  carat: Range | Any;
  origin: (typeof ORIGIN_PREFERENCES)[number] | Any;
  centerStones: CenterStone[] | Any;
  settings: Setting[] | Any;
  prongs: Prong[] | Any;
  metals: Metal[] | Any;
  bandWidthMm: Range | Any;
  bandStyles: BandStyle[] | Any;
  bandProfiles: BandProfile[] | Any;
  budget: Range | Any;
};

export const DEFAULT_STATED_PREFS: StatedPrefs = {
  shapes: ANY,
  cuts: ANY,
  colorGroups: ANY,
  clarities: ANY,
  carat: ANY,
  origin: ANY,
  centerStones: ANY,
  settings: ANY,
  prongs: ANY,
  metals: ANY,
  bandWidthMm: ANY,
  bandStyles: ANY,
  bandProfiles: ANY,
  budget: ANY,
};

/** Shapes that use a lathed (round) brilliant profile in the procedural renderer. */
export const LATHED_SHAPES: readonly Shape[] = ["Round", "Old Mine/Old European"];

/** Swipe actions. "strong_dislike" = the "Hard no" button (strongly dislike). */
export const SWIPE_ACTIONS = ["strong_dislike", "dislike", "like", "revisit", "love"] as const;
export type SwipeAction = (typeof SWIPE_ACTIONS)[number];
export const INTERACTION_ACTIONS = [...SWIPE_ACTIONS, "undo"] as const;
export type InteractionAction = (typeof INTERACTION_ACTIONS)[number];


export const RENDER_TYPES = ["photo", "360", "cad", "procedural"] as const;
export type RenderType = (typeof RENDER_TYPES)[number];
export const IMAGE_KINDS = ["photo", "360", "cad"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

/** Carat brackets — used for onboarding choices and as learned-taste features. */
export const CARAT_BANDS = [
  { id: "under-0.75", label: "Under 0.75 ct", min: 0, max: 0.75 },
  { id: "0.75-1.25", label: "0.75–1.25 ct", min: 0.75, max: 1.25 },
  { id: "1.25-2", label: "1.25–2 ct", min: 1.25, max: 2 },
  { id: "2-3", label: "2–3 ct", min: 2, max: 3 },
  { id: "3-plus", label: "3 ct and up", min: 3, max: CARAT_BOUNDS.max },
] as const;
export type CaratBandId = (typeof CARAT_BANDS)[number]["id"];

/** Budget brackets (USD) — used for onboarding choices and as learned-taste features. */
export const BUDGET_BANDS = [
  { id: "under-2k", label: "Under $2,000", min: 0, max: 2_000 },
  { id: "2k-5k", label: "$2,000–5,000", min: 2_000, max: 5_000 },
  { id: "5k-10k", label: "$5,000–10,000", min: 5_000, max: 10_000 },
  { id: "10k-20k", label: "$10,000–20,000", min: 10_000, max: 20_000 },
  { id: "20k-plus", label: "$20,000 and up", min: 20_000, max: BUDGET_BOUNDS.max },
] as const;
export type BudgetBandId = (typeof BUDGET_BANDS)[number]["id"];

export function caratBandOf(carat: number | null | undefined): CaratBandId | null {
  if (carat == null) return null;
  return (CARAT_BANDS.find((b) => carat >= b.min && carat < b.max) ?? CARAT_BANDS[CARAT_BANDS.length - 1]!).id;
}

export function budgetBandOf(price: number | null | undefined): BudgetBandId | null {
  if (price == null) return null;
  return (BUDGET_BANDS.find((b) => price >= b.min && price < b.max) ?? BUDGET_BANDS[BUDGET_BANDS.length - 1]!).id;
}

/**
 * How retailers write taxonomy values in titles, tags and descriptions (lower-case phrases).
 * Used by the importer (src/sources/extract.ts). Order matters: earlier entries win, so the
 * more specific phrase comes first (e.g. "Elongated Cushion" before "Cushion", "Hidden Halo" before "Halo").
 */
export const TEXT_SYNONYMS = {
  shape: [
    ["Old Mine/Old European", ["old mine", "old european", "old euro", "transitional cut", "european cut", "old cut", "antique cushion"]],
    ["Elongated Cushion", ["elongated cushion"]],
    ["Cushion", ["cushion"]],
    ["Oval", ["oval"]],
    ["Emerald", ["emerald cut", "emerald-cut", "emerald step", "emerald lab diamond", "emerald natural diamond", "emerald diamond"]],
    ["Asscher", ["asscher"]],
    ["Princess", ["princess"]],
    ["Pear", ["pear"]],
    ["Marquise", ["marquise"]],
    ["Radiant", ["radiant"]],
    ["Heart", ["heart shape", "heart-shape", "heart cut", "heart lab diamond", "heart natural diamond", "heart diamond"]],
    ["Round", ["round brilliant", "round cut", "round lab diamond", "round natural diamond", "round diamond", "round"]],
  ],
  setting: [
    ["Hidden Halo", ["hidden halo"]],
    ["Halo", ["halo"]],
    ["Three-Stone", ["three stone", "three-stone", "3 stone", "3-stone", "trilogy"]],
    ["Toi et Moi", ["toi et moi", "toi-et-moi", "two stone", "two-stone", "2 stone"]],
    ["Cluster", ["cluster"]],
    ["Bezel", ["bezel"]],
    ["Split Shank", ["split shank", "split-shank"]],
    ["Cathedral", ["cathedral"]],
    ["Pavé", ["pavé", "pave "]],
    ["Vintage/Milgrain", ["milgrain", "art deco", "edwardian", "victorian", "georgian", "belle epoque", "filigree", "retro era"]],
    ["Solitaire", ["solitaire"]],
  ],
  metal: [
    ["Two-tone", ["two tone", "two-tone", "silver on", "silver-topped", "platinum topped", "platinum-topped", "silver top"]],
    ["Platinum", ["platinum"]],
    ["Rose Gold", ["rose gold", "pink gold"]],
    ["White Gold", ["white gold"]],
    ["Yellow Gold", ["yellow gold", "18k gold", "14k gold", "22k gold", "10k gold", "18 karat gold", "14 karat gold"]],
  ],
  prongs: [
    ["Double", ["double prong", "double claw", "double-prong"]],
    ["Compass", ["compass", "north-south-east-west", "north south east west"]],
    ["Claw", ["claw"]],
    ["6", ["six prong", "6 prong", "6-prong", "six-prong"]],
    ["4", ["four prong", "4 prong", "4-prong", "four-prong"]],
  ],
  centerStone: [
    ["Sapphire", ["sapphire"]],
    ["Moissanite", ["moissanite"]],
    ["Other", ["ruby", "spinel", "morganite", "aquamarine", "garnet", "tourmaline", "opal", "pearl", "emerald ring", "emerald and diamond", "tanzanite", "topaz"]],
    ["Diamond", ["diamond"]],
  ],
  origin: [
    ["Lab-grown", ["lab grown", "lab-grown", "lab diamond", "lab created", "lab-created"]],
    ["Natural", ["natural", "gia", "mined", "antique", "vintage", "victorian", "edwardian", "art deco", "old mine", "old european", "georgian", "estate"]],
  ],
  cut: [
    ["Ideal/Excellent", ["excellent cut", "ideal cut", "cut: excellent", "cut: ideal"]],
    ["Very Good", ["very good cut", "cut: very good"]],
  ],
  bandStyle: [["Pavé", ["pavé band", "pave band", "diamond band", "pavé shank", "pave shank"]]],
  bandProfile: [["Tapered", ["tapered", "tapering"]]],
} as const satisfies {
  shape: readonly (readonly [Shape, readonly string[]])[];
  setting: readonly (readonly [Setting, readonly string[]])[];
  metal: readonly (readonly [Metal, readonly string[]])[];
  prongs: readonly (readonly [Prong, readonly string[]])[];
  centerStone: readonly (readonly [CenterStone, readonly string[]])[];
  origin: readonly (readonly [Origin, readonly string[]])[];
  cut: readonly (readonly [Cut, readonly string[]])[];
  bandStyle: readonly (readonly [BandStyle, readonly string[]])[];
  bandProfile: readonly (readonly [BandProfile, readonly string[]])[];
};
