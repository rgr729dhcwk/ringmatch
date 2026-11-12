/**
 * Turns ProceduralParams into a scene description (pure data, no React):
 * band parts, stones, prongs, accent stones, metal rims. ProceduralRing renders it.
 */
import type { Prong, Shape } from "@/lib/taxonomy";
import type { ProceduralParams } from "@/lib/visual";
import { bandOuterRadius, RING_INNER_RADIUS, topWeight } from "./band";
import { offsetOutline, outlinePointAt, samplePerimeter, stoneDims, stoneOutline, type Pt } from "./outline";
import { makeStone } from "./stone";

export type Vec3 = [number, number, number];

export type BandPart = { widthMm: number; zOffset?: (u: number) => number; widthScale?: (u: number) => number };
export type StonePlacement = { shape: Shape; carat: number; position: Vec3; rotation: Vec3; prongs: Prong | null; role: "center" | "side" };
export type Tube = { points: Vec3[]; radius: number; closed?: boolean; part: "head" | "band" };
export type Spheres = { positions: Vec3[]; radius: number; material: "stone" | "head" | "band" };
export type Rim = { outline: Pt[]; inner: number; outer: number; y0: number; y1: number; position: Vec3 };

export type RingLayout = {
  bandParts: BandPart[];
  bandThickness: number;
  stones: StonePlacement[];
  tubes: Tube[];
  spheres: Spheres[];
  rims: Rim[];
  /** Vertical extent, for camera framing. */
  top: number;
  bottom: number;
};

const PRONG_ANGLES: Record<Prong, number[]> = {
  "4": [45, 135, 225, 315],
  "6": [0, 60, 120, 180, 240, 300],
  Claw: [45, 135, 225, 315],
  Double: [38, 52, 128, 142, 218, 232, 308, 322],
  Compass: [0, 90, 180, 270],
};

const deg = (d: number) => (d * Math.PI) / 180;

/** Prongs for one stone: a tube from the basket up over the girdle edge, plus a tip bead. */
function prongsFor(shape: Shape, carat: number, prong: Prong, center: Vec3, rotZ: number, out: RingLayout) {
  const s = makeStone(shape, carat);
  s.geometry.dispose();
  const r = Math.max(0.28, 0.08 * Math.min(s.w, s.l));
  const tips: Vec3[] = [];
  for (const a of PRONG_ANGLES[prong]) {
    // Outline angle in shape space (x across, y along finger).
    const [px, py] = outlinePointAt(s.outline, deg(a));
    const lx = px * 1.04;
    const lz = -py * 1.04;
    const tipY = s.girdle + s.crown * 0.35;
    const baseY = -s.pavilion * 0.95;
    const local: Vec3[] = [
      [px * 0.35, baseY, -py * 0.35],
      [lx * 0.9, -s.pavilion * 0.35, lz * 0.9],
      [lx, s.girdle, lz],
      [lx * 0.93, tipY, lz * 0.93],
    ];
    const pts = local.map((p) => rotateZ(p, rotZ, center));
    out.tubes.push({ points: pts, radius: r, part: "head" });
    tips.push(pts[pts.length - 1]!);
  }
  out.spheres.push({ positions: tips, radius: prong === "Claw" ? r * 0.9 : r * 1.25, material: "head" });
}

function rotateZ([x, y, z]: Vec3, a: number, [cx, cy, cz]: Vec3): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s + cx, x * s + y * c + cy, z + cz];
}

export function layoutRing(p: ProceduralParams): RingLayout {
  const thickness = 1.7;
  const rOut = bandOuterRadius(thickness);
  const out: RingLayout = { bandParts: [], bandThickness: thickness, stones: [], tubes: [], spheres: [], rims: [], top: 0, bottom: -rOut };

  // --- center stone sizing (cluster/toi et moi shrink the main stone) ---
  const setting = p.setting;
  const mainCarat = setting === "Cluster" ? p.caratWeight * 0.55 : setting === "Toi et Moi" ? p.caratWeight * 0.6 : p.caratWeight;
  const main = makeStone(p.shape, mainCarat);
  main.geometry.dispose();
  const seat = setting === "Bezel" ? 0.55 : 0.8; // how much of the pavilion hangs above the band
  const y0 = rOut + main.pavilion * seat + 0.25;
  const centerPos: Vec3 = [0, y0, 0];

  // --- band ---
  const w = p.bandWidthMm;
  if (setting === "Split Shank") {
    const half = w * 0.48;
    const split = (sign: number) => (u: number) => sign * (half * 0.55 + topWeight(u, 5) * (main.l * 0.32));
    out.bandParts.push({ widthMm: half, zOffset: split(1) }, { widthMm: half, zOffset: split(-1) });
  } else {
    out.bandParts.push({ widthMm: w });
  }

  // --- stones ---
  if (setting === "Toi et Moi") {
    const second: Shape = p.shape === "Pear" ? "Oval" : "Pear";
    const d1 = stoneDims(p.shape, mainCarat);
    const d2 = stoneDims(second, mainCarat * 0.9);
    const gap = 0.35;
    out.stones.push(
      { shape: p.shape, carat: mainCarat, position: [-(d1.w / 2 + gap), y0 - 0.2, 0.6], rotation: [0, 0, 0.18], prongs: p.prongs, role: "center" },
      { shape: second, carat: mainCarat * 0.9, position: [d2.w / 2 + gap, y0 - 0.2, -0.6], rotation: [0, 0, -0.18], prongs: p.prongs, role: "center" },
    );
  } else {
    out.stones.push({ shape: p.shape, carat: mainCarat, position: centerPos, rotation: [0, 0, 0], prongs: setting === "Bezel" ? null : p.prongs, role: "center" });
  }

  if (setting === "Three-Stone") {
    const sideCarat = mainCarat * 0.3;
    const sd = stoneDims(p.shape, sideCarat);
    const dx = main.w / 2 + sd.w / 2 + 0.3;
    for (const sign of [-1, 1]) {
      out.stones.push({
        shape: p.shape,
        carat: sideCarat,
        position: [sign * dx, y0 - 1.1, 0],
        rotation: [0, 0, -sign * 0.28],
        prongs: "4",
        role: "side",
      });
    }
  }

  if (setting === "Cluster") {
    const petals = 8;
    const ringR = Math.max(main.w, main.l) / 2 + 0.9;
    const pr = Math.max(0.55, main.w * 0.17);
    const pos: Vec3[] = [];
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      pos.push([Math.cos(a) * ringR, y0 + main.girdle * 0.5, Math.sin(a) * ringR * (main.l / main.w)]);
    }
    out.spheres.push({ positions: pos, radius: pr, material: "stone" });
    out.tubes.push({
      points: pos.map(([x, , z]) => [x, y0 - 0.5, z] as Vec3),
      radius: 0.45,
      closed: true,
      part: "head",
    });
  }

  // --- halos ---
  if (setting === "Halo" || setting === "Vintage/Milgrain") {
    const haloOutline = offsetOutline(main.outline, 0.85);
    const melee = 0.42;
    const pts = samplePerimeter(haloOutline, melee * 2.15);
    out.spheres.push({ positions: pts.map(([x, y]) => [x, y0 + main.girdle * 0.5 - 0.15, -y] as Vec3), radius: melee, material: "stone" });
    out.tubes.push({ points: haloOutline.map(([x, y]) => [x, y0 - 0.45, -y] as Vec3), radius: 0.5, closed: true, part: "head" });
    if (setting === "Vintage/Milgrain") {
      const beads = samplePerimeter(offsetOutline(main.outline, 1.55), 0.4);
      out.spheres.push({ positions: beads.map(([x, y]) => [x, y0 - 0.15, -y] as Vec3), radius: 0.17, material: "head" });
    }
  }
  if (setting === "Hidden Halo") {
    const ring = offsetOutline(main.outline, -0.05);
    const pts = samplePerimeter(ring, 0.7);
    const yh = y0 - main.pavilion * 0.45;
    const scale = 0.72;
    out.spheres.push({ positions: pts.map(([x, y]) => [x * scale, yh, -y * scale] as Vec3), radius: 0.32, material: "stone" });
  }

  // --- bezel rim ---
  if (setting === "Bezel") {
    out.rims.push({
      outline: main.outline,
      inner: 0.99,
      outer: 1.12,
      y0: -main.pavilion * 0.55,
      y1: main.girdle + main.crown * 0.3,
      position: centerPos,
    });
  }

  // --- prongs ---
  for (const st of out.stones) {
    if (st.prongs) prongsFor(st.shape, st.carat, st.prongs, st.position, st.rotation[2], out);
  }

  // --- basket / gallery under the center stone (not for bezel) ---
  if (setting !== "Bezel" && setting !== "Toi et Moi") {
    const gal = main.outline.map(([x, y]) => [x * 0.55, y0 - main.pavilion * 0.55, -y * 0.55] as Vec3);
    out.tubes.push({ points: gal, radius: 0.3, closed: true, part: "head" });
  }

  // --- cathedral arches ---
  if (setting === "Cathedral") {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const u = Math.PI / 2 + sx * 0.55;
        out.tubes.push({
          points: [
            [Math.cos(u) * (rOut - 0.3), Math.sin(u) * (rOut - 0.3), sz * w * 0.3],
            [sx * main.w * 0.45, y0 - main.pavilion * 0.55, sz * w * 0.3],
            [sx * main.w * 0.32, y0 - 0.1, sz * main.l * 0.18],
          ],
          radius: Math.min(0.55, w * 0.18),
          part: "head",
        });
      }
    }
  }

  // --- pavé on the band ---
  const pave = p.bandStyle === "Pavé" || setting === "Pavé";
  if (pave) {
    const pts: Vec3[] = [];
    const bandW = setting === "Split Shank" ? w * 0.48 : w;
    const melee = Math.min(0.32, bandW * 0.17);
    const rows = bandW >= 2.6 ? [-bandW * 0.22, bandW * 0.22] : [0];
    const step = (melee * 2.3) / rOut;
    const rr = rOut - melee * 0.45;
    for (const side of [-1, 1]) {
      for (let u = 0.32; u <= 1.5; u += step) {
        const ang = Math.PI / 2 + side * u;
        const taper = p.bandProfile === "Tapered" ? 1 - 0.45 * topWeight(ang, 3) : 1;
        for (const z of rows) {
          const zz = setting === "Split Shank" ? 0 : z * taper;
          if (setting === "Split Shank") {
            const half = w * 0.48;
            for (const sgn of [-1, 1]) {
              const off = sgn * (half * 0.55 + topWeight(ang, 5) * (main.l * 0.32));
              pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr, off]);
            }
          } else {
            pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr, zz]);
          }
        }
      }
    }
    out.spheres.push({ positions: pts, radius: melee, material: "stone" });
  }

  // --- milgrain along band edges ---
  if (setting === "Vintage/Milgrain") {
    const pts: Vec3[] = [];
    const n = 220;
    for (let i = 0; i < n; i++) {
      const u = (i / n) * Math.PI * 2;
      const taper = p.bandProfile === "Tapered" ? 1 - 0.45 * topWeight(u, 3) : 1;
      for (const sz of [-1, 1]) {
        pts.push([Math.cos(u) * (rOut - 0.25), Math.sin(u) * (rOut - 0.25), sz * (w / 2) * taper * 0.97]);
      }
    }
    out.spheres.push({ positions: pts, radius: 0.16, material: "band" });
  }

  out.top = Math.max(...out.stones.map((s) => s.position[1])) + main.girdle + main.crown + 0.3;
  out.bottom = -(RING_INNER_RADIUS + thickness);
  return out;
}

export { stoneOutline };
