import type { ProceduralParams } from "@/lib/visual";
import { offsetOutline, samplePerimeter, stoneDims, stoneOutline } from "./geometry/outline";
import { METAL_SWATCH, STONE_SWATCH } from "./materials";

/**
 * Lightweight 2D sketch of a ring from its attributes. Used for the card peeking behind the
 * top card (no WebGL there) and as the fallback when WebGL is unavailable.
 */
export function RingSketch({ params }: { params: ProceduralParams }) {
  const { w, l } = stoneDims(params.shape, params.caratWeight);
  const k = 7; // px per mm
  const outline = stoneOutline(params.shape, w * k, l * k * 0.55); // squash: seen from 3/4
  const cx = 150;
  const cy = 112;
  const band = params.metal === "Two-tone" ? METAL_SWATCH["White Gold"] : METAL_SWATCH[params.metal];
  const head = params.metal === "Two-tone" ? METAL_SWATCH["Yellow Gold"] : band;
  const halo = params.setting === "Halo" || params.setting === "Vintage/Milgrain";
  const haloDots = halo ? samplePerimeter(offsetOutline(outline, 9), 9) : [];
  const toPath = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${(cx + x).toFixed(1)},${(cy - y).toFixed(1)}`).join(" ") + "Z";
  return (
    <svg viewBox="0 0 300 300" className="h-full w-full" role="img" aria-label={`Sketch of a ${params.shape} ${params.setting} ring`} data-testid="ring-sketch">
      <defs>
        <linearGradient id="rs-stone" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor={STONE_SWATCH[params.centerStone]} />
        </linearGradient>
      </defs>
      <ellipse cx={150} cy={190} rx={92} ry={70} fill="none" stroke={band} strokeWidth={Math.max(6, params.bandWidthMm * 5)} />
      {haloDots.map(([x, y], i) => (
        <circle key={i} cx={cx + x} cy={cy - y} r={3.4} fill="#f4f8ff" stroke="#aab" strokeWidth={0.6} />
      ))}
      <path d={toPath(outline)} fill="url(#rs-stone)" stroke={head} strokeWidth={params.setting === "Bezel" ? 6 : 2.5} />
    </svg>
  );
}
