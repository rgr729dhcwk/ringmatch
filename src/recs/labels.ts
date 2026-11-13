/** Human-friendly phrases for taste features ("oval stones", "rose gold"). Pure. */
import { BUDGET_BANDS, CARAT_BANDS } from "@/lib/taxonomy";
import { splitFeature, type Dimension } from "./features";

const lower = (s: string) => s.toLowerCase();

export function phraseFor(feature: string): string {
  const [d, v] = splitFeature(feature);
  switch (d as Dimension) {
    case "shape":
      return v === "Old Mine/Old European" ? "old mine and old European cuts" : `${lower(v)} stones`;
    case "setting":
      if (v === "Pavé") return "pavé settings";
      if (v === "Vintage/Milgrain") return "vintage milgrain settings";
      if (v === "Toi et Moi") return "toi et moi (two-stone) rings";
      return `${lower(v)} settings`;
    case "metal":
      return v === "Two-tone" ? "two-tone metal" : lower(v);
    case "centerStone":
      return v === "Other" ? "colored gemstones" : v === "Moissanite" ? "moissanite" : `${lower(v)}s`;
    case "origin":
      return v === "Lab-grown" ? "lab-grown stones" : "natural stones";
    case "carat":
      return `${CARAT_BANDS.find((b) => b.id === v)?.label ?? v} stones`;
    case "budget":
      return `rings around ${BUDGET_BANDS.find((b) => b.id === v)?.label ?? v}`;
    case "prongs":
      return v === "Compass" ? "compass prongs" : v === "4" || v === "6" ? `${v}-prong heads` : `${lower(v)} prongs`;
    case "colorGroup":
      return `${lower(v)} diamonds`;
    case "clarity":
      return `${v} clarity`;
    case "bandStyle":
      return v === "Pavé" ? "pavé bands" : "plain bands";
    case "bandProfile":
      return `${lower(v)} bands`;
  }
}

/** "a", "a and b", "a, b and c" */
export function joinPhrases(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
