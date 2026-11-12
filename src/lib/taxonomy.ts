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

export const SWIPE_ACTIONS = ["dislike", "like", "revisit", "love"] as const;
export type SwipeAction = (typeof SWIPE_ACTIONS)[number];
export const INTERACTION_ACTIONS = [...SWIPE_ACTIONS, "undo"] as const;
export type InteractionAction = (typeof INTERACTION_ACTIONS)[number];


export const RENDER_TYPES = ["photo", "360", "cad", "procedural"] as const;
export type RenderType = (typeof RENDER_TYPES)[number];
export const IMAGE_KINDS = ["photo", "360", "cad"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];
