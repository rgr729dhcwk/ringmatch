/**
 * 2D stone outlines (top view). Coordinates: x = across the finger, y = along the finger.
 * Pure math (no three.js) so the SVG fallback can reuse them.
 */
import { LATHED_SHAPES, type Shape } from "@/lib/taxonomy";

export type Pt = [number, number];

/** Length/width ratio per shape (length runs along the finger). */
export const SHAPE_RATIO: Record<Shape, number> = {
  Round: 1,
  "Old Mine/Old European": 1,
  Oval: 1.4,
  Cushion: 1.05,
  "Elongated Cushion": 1.35,
  Emerald: 1.45,
  Princess: 1,
  Pear: 1.6,
  Marquise: 2,
  Radiant: 1.25,
  Asscher: 1,
  Heart: 1,
};

/** Round-equivalent diameter (mm) of a stone: ~6.5mm at 1ct, scaled by the cube root of carat. */
export function roundDiameterMm(carat: number): number {
  return 6.5 * Math.cbrt(Math.max(0.05, carat));
}

/** Width and length (mm) for a shape and carat weight. */
export function stoneDims(shape: Shape, carat: number): { w: number; l: number } {
  const d = roundDiameterMm(carat);
  const r = SHAPE_RATIO[shape];
  const w = (d * (r === 1 ? 1 : 0.95)) / Math.sqrt(r);
  return { w, l: w * r };
}

const N = 64;
const sgnPow = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p);

function superellipse(a: number, b: number, n: number): Pt[] {
  return Array.from({ length: N }, (_, i) => {
    const t = (i / N) * Math.PI * 2;
    return [a * sgnPow(Math.cos(t), 2 / n), b * sgnPow(Math.sin(t), 2 / n)] as Pt;
  });
}

function cutCornerRect(a: number, b: number, c: number): Pt[] {
  const k = Math.min(a, b) * c;
  if (k < 1e-6) return [[a, -b], [a, b], [-a, b], [-a, -b]];
  return [
    [a, -b + k], [a, b - k], [a - k, b], [-a + k, b],
    [-a, b - k], [-a, -b + k], [-a + k, -b], [a - k, -b],
  ];
}

function pear(a: number, b: number): Pt[] {
  // Teardrop: point toward +y. x = sin t * sin(t/2), y = cos t, normalized to a/b.
  const raw = Array.from({ length: N }, (_, i) => {
    const t = (i / N) * Math.PI * 2;
    return [Math.sin(t) * Math.sin(t / 2), Math.cos(t)] as Pt;
  });
  const maxX = Math.max(...raw.map((p) => Math.abs(p[0])));
  return raw.map(([x, y]) => [(x / maxX) * a, y * b] as Pt).reverse();
}

function marquise(a: number, b: number): Pt[] {
  const half = N / 2;
  const right: Pt[] = Array.from({ length: half }, (_, i) => {
    const y = -b + (2 * b * i) / half;
    return [a * (1 - Math.pow(Math.abs(y / b), 1.9)), y];
  });
  const left: Pt[] = right.map(([x, y]) => [-x, -y]);
  return [...right, ...left];
}

function heart(a: number, b: number): Pt[] {
  const raw = Array.from({ length: N }, (_, i) => {
    const t = (i / N) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [x, y] as Pt;
  });
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const sx = (Math.max(...xs) - Math.min(...xs)) / 2;
  const sy = (Math.max(...ys) - Math.min(...ys)) / 2;
  return raw.map(([x, y]) => [((x - cx) / sx) * a, ((y - cy) / sy) * b] as Pt).reverse();
}

/** Counter-clockwise outline for a shape with full width w and length l. */
export function stoneOutline(shape: Shape, w: number, l: number): Pt[] {
  const a = w / 2;
  const b = l / 2;
  let pts: Pt[];
  switch (shape) {
    case "Round":
    case "Old Mine/Old European":
    case "Oval":
      pts = superellipse(a, b, 2);
      break;
    case "Cushion":
    case "Elongated Cushion":
      pts = superellipse(a, b, 3.2);
      break;
    case "Emerald":
      pts = cutCornerRect(a, b, 0.22);
      break;
    case "Asscher":
      pts = cutCornerRect(a, b, 0.3);
      break;
    case "Radiant":
      pts = cutCornerRect(a, b, 0.14);
      break;
    case "Princess":
      pts = cutCornerRect(a, b, 0);
      break;
    case "Pear":
      pts = pear(a, b);
      break;
    case "Marquise":
      pts = marquise(a, b);
      break;
    case "Heart":
      pts = heart(a, b);
      break;
  }
  return isClockwise(pts) ? pts.reverse() : pts;
}

export function isClockwise(pts: Pt[]): boolean {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[(i + 1) % pts.length]!;
    s += (x2 - x1) * (y2 + y1);
  }
  return s > 0;
}

/** Outline point closest to the given direction (radians, 0 = +x). */
export function outlinePointAt(pts: Pt[], angle: number): Pt {
  let best = pts[0]!;
  let bestD = Infinity;
  for (const p of pts) {
    let d = Math.abs(Math.atan2(p[1], p[0]) - angle);
    d = Math.min(d, Math.PI * 2 - d);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Push every point outward by `dist` (approximate offset for star-shaped outlines). */
export function offsetOutline(pts: Pt[], dist: number): Pt[] {
  return pts.map(([x, y]) => {
    const r = Math.hypot(x, y) || 1;
    return [x * (1 + dist / r), y * (1 + dist / r)] as Pt;
  });
}

/** Evenly spaced points along a closed outline, `spacing` apart. */
export function samplePerimeter(pts: Pt[], spacing: number): Pt[] {
  const segs = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) };
  });
  const total = segs.reduce((s, x) => s + x.len, 0);
  const count = Math.max(6, Math.round(total / spacing));
  const step = total / count;
  const out: Pt[] = [];
  let si = 0;
  let acc = 0;
  for (let k = 0; k < count; k++) {
    const target = k * step;
    while (si < segs.length - 1 && acc + segs[si]!.len < target) acc += segs[si++]!.len;
    const s = segs[si]!;
    const t = s.len ? (target - acc) / s.len : 0;
    out.push([s.p[0] + (s.q[0] - s.p[0]) * t, s.p[1] + (s.q[1] - s.p[1]) * t]);
  }
  return out;
}

export const isLathed = (shape: Shape) => LATHED_SHAPES.includes(shape);
