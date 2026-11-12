import * as THREE from "three";
import type { Shape } from "@/lib/taxonomy";
import { stoneDims, stoneOutline, type Pt } from "./outline";

export type StoneGeometry = {
  geometry: THREE.BufferGeometry;
  outline: Pt[];
  w: number;
  l: number;
  /** Depth below the girdle (positive number). */
  pavilion: number;
  /** Height above the girdle. */
  crown: number;
  girdle: number;
};

/** Lathed brilliant (Round) or old-mine profile. Girdle bottom sits at y = 0. */
function lathedStone(shape: Shape, d: number): THREE.BufferGeometry {
  const old = shape === "Old Mine/Old European";
  const r = d / 2;
  const pts = old
    ? [[0.05 * d, -0.42 * d], [r, 0], [r, 0.02 * d], [0.4 * d, 0.12 * d], [0.24 * d, 0.2 * d], [0, 0.2 * d]]
    : [[0.001, -0.43 * d], [r * 0.82, -0.12 * d], [r, 0], [r, 0.025 * d], [0.39 * d, 0.11 * d], [0.28 * d, 0.16 * d], [0, 0.16 * d]];
  const geo = new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    old ? 12 : 16,
  );
  return geo.toNonIndexed();
}

/** Extruded fancy shape with a crown bevel; the bottom bevel is stretched into a pavilion. */
function extrudedStone(shape: Shape, w: number, l: number, outline: Pt[]) {
  const minHalf = Math.min(w, l) / 2;
  const bevelSize = minHalf * 0.3;
  const crown = minHalf * 0.32;
  const girdle = minHalf * 0.05;
  const step = shape === "Emerald" || shape === "Asscher";
  // Inset the outline so outline + bevel ≈ the full girdle outline.
  const inset = outline.map(([x, y]) => {
    const r = Math.hypot(x, y) || 1;
    const f = Math.max(0.2, 1 - bevelSize / r);
    return new THREE.Vector2(x * f, y * f);
  });
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(inset), {
    depth: girdle,
    bevelEnabled: true,
    bevelThickness: crown,
    bevelSize,
    bevelSegments: step ? 3 : 1,
    curveSegments: 4,
  });
  // Extrusion runs along +z; turn it so it runs up (+y). Shape y → -z.
  geo.rotateX(-Math.PI / 2);
  // Now crown is above y=girdle, pavilion below y=0. Deepen and taper the pavilion.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const pavilionFactor = 2.4;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 0) {
      const t = Math.min(1, -y / crown);
      const s = 1 - (step ? 0.55 : 0.8) * t;
      pos.setXYZ(i, pos.getX(i) * s, y * pavilionFactor, pos.getZ(i) * s);
    }
  }
  pos.needsUpdate = true;
  return { geometry: geo, crown, girdle, pavilion: crown * pavilionFactor };
}

/** Stone geometry with the girdle bottom at y = 0, length along z (the finger). */
export function makeStone(shape: Shape, carat: number): StoneGeometry {
  const { w, l } = stoneDims(shape, carat);
  const outline = stoneOutline(shape, w, l);
  if (shape === "Round" || shape === "Old Mine/Old European") {
    const old = shape !== "Round";
    const geometry = lathedStone(shape, w);
    geometry.computeVertexNormals();
    return { geometry, outline, w, l, pavilion: (old ? 0.42 : 0.43) * w, crown: (old ? 0.2 : 0.16) * w, girdle: 0.025 * w };
  }
  const s = extrudedStone(shape, w, l, outline);
  s.geometry.computeVertexNormals();
  return { geometry: s.geometry, outline, w, l, pavilion: s.pavilion, crown: s.crown, girdle: s.girdle };
}

/** Outline point (x across, y along finger) → 3D (x, ?, z). Shape y maps to -z. */
export const toXZ = ([x, y]: Pt): [number, number] => [x, -y];
