import * as THREE from "three";
import type { CenterStone, Metal } from "@/lib/taxonomy";

type MetalLook = { color: string; roughness: number };

export const METAL_LOOKS: Record<Exclude<Metal, "Two-tone">, MetalLook> = {
  "Yellow Gold": { color: "#e8bd5a", roughness: 0.2 },
  "White Gold": { color: "#e4e4e0", roughness: 0.16 },
  "Rose Gold": { color: "#e7a58c", roughness: 0.2 },
  Platinum: { color: "#d3d4d4", roughness: 0.24 },
};

/** Flat swatch colors (used by the SVG fallback and UI chips). */
export const METAL_SWATCH: Record<Metal, string> = {
  "Yellow Gold": "#d9a93f",
  "White Gold": "#c9cbcc",
  "Rose Gold": "#d68f78",
  Platinum: "#b8babb",
  "Two-tone": "#c9cbcc",
};

/** Two-tone = white band + yellow head. */
export function metalsFor(metal: Metal): { band: MetalLook; head: MetalLook } {
  if (metal === "Two-tone") return { band: METAL_LOOKS["White Gold"], head: METAL_LOOKS["Yellow Gold"] };
  const m = METAL_LOOKS[metal];
  return { band: m, head: m };
}

export function makeMetalMaterial(look: MetalLook) {
  return new THREE.MeshPhysicalMaterial({
    color: look.color,
    metalness: 1,
    roughness: look.roughness,
    clearcoat: 0.4,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.25,
  });
}

const STONE_LOOK: Record<CenterStone, { color: string; ior: number; attenuation: string; dispersion: number }> = {
  Diamond: { color: "#ffffff", ior: 2.42, attenuation: "#ffffff", dispersion: 0.35 },
  Moissanite: { color: "#fbfff8", ior: 2.65, attenuation: "#f4fff0", dispersion: 0.9 },
  Sapphire: { color: "#3c5fd6", ior: 1.77, attenuation: "#1b2f8f", dispersion: 0.1 },
  Other: { color: "#f4c6cc", ior: 1.58, attenuation: "#e79aa5", dispersion: 0.1 },
};

export const STONE_SWATCH: Record<CenterStone, string> = {
  Diamond: "#eef6ff",
  Moissanite: "#f2fbf2",
  Sapphire: "#3c5fd6",
  Other: "#f2bcc5",
};

/** Transmissive, faceted material for center stones. */
export function makeStoneMaterial(stone: CenterStone) {
  const s = STONE_LOOK[stone];
  return new THREE.MeshPhysicalMaterial({
    color: s.color,
    metalness: 0,
    roughness: 0,
    transmission: 1,
    thickness: 1.5,
    ior: s.ior,
    dispersion: s.dispersion,
    attenuationColor: new THREE.Color(s.attenuation),
    attenuationDistance: stone === "Diamond" || stone === "Moissanite" ? 50 : 4,
    specularIntensity: 1,
    envMapIntensity: 1.1,
    flatShading: true,
  });
}

/** Cheaper reflective material for small accent stones (no transmission). */
export function makeMeleeMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    metalness: 0.1,
    roughness: 0.02,
    ior: 2.42,
    specularIntensity: 1,
    envMapIntensity: 3,
    flatShading: true,
  });
}
