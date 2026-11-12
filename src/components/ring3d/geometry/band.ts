import * as THREE from "three";
import type { BandProfile } from "@/lib/taxonomy";

export const RING_INNER_RADIUS = 8.4; // mm (≈ US size 6)

export type BandOptions = {
  widthMm: number;
  thicknessMm?: number;
  profile: BandProfile;
  /** Axial offset as a function of angle (for split shanks). */
  zOffset?: (u: number) => number;
  /** Multiplier on width as a function of angle. */
  widthScale?: (u: number) => number;
};

/** Weight near the top of the ring (u = π/2), 0 at the bottom. */
export const topWeight = (u: number, sharp = 4) => Math.pow(Math.max(0, Math.cos(u - Math.PI / 2)), sharp);

/**
 * A comfort-fit band swept around the z axis. The cross-section is a rounded rectangle
 * (superellipse) whose width/offset can vary with angle — that's how tapered and split shanks work.
 */
export function makeBand(opts: BandOptions): THREE.BufferGeometry {
  const U = 192;
  const P = 28;
  const t0 = opts.thicknessMm ?? 1.7;
  const n = 4;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < U; i++) {
    const u = (i / U) * Math.PI * 2;
    const taper = opts.profile === "Tapered" ? 1 - 0.45 * topWeight(u, 3) : 1;
    const w = opts.widthMm * taper * (opts.widthScale?.(u) ?? 1);
    const t = t0 * (opts.profile === "Tapered" ? 1 - 0.25 * topWeight(u, 3) : 1);
    const z0 = opts.zOffset?.(u) ?? 0;
    for (let j = 0; j < P; j++) {
      const phi = (j / P) * Math.PI * 2;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      const radial = RING_INNER_RADIUS + t / 2 + (t / 2) * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const axial = z0 + (w / 2) * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      positions.push(Math.cos(u) * radial, Math.sin(u) * radial, axial);
    }
  }
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < P; j++) {
      const a = i * P + j;
      const b = ((i + 1) % U) * P + j;
      const c = ((i + 1) % U) * P + ((j + 1) % P);
      const d = i * P + ((j + 1) % P);
      indices.push(a, d, b, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function bandOuterRadius(thicknessMm = 1.7) {
  return RING_INNER_RADIUS + thicknessMm;
}
