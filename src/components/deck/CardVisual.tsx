"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { RingSketch } from "@/components/ring3d/RingSketch";
import { PROCEDURAL_BADGE, type Visual } from "@/lib/visual";

const ProceduralRing = dynamic(() => import("@/components/ring3d/ProceduralRing"), {
  ssr: false,
  loading: () => null,
});

/**
 * The visual area of a card. Every card has one: validated photos, or a procedural render.
 * Only the top card mounts a live WebGL canvas; cards underneath show a lightweight sketch.
 */
export function CardVisual({ visual, title, live }: { visual: Visual; title: string; live: boolean }) {
  const [rendered, setRendered] = useState<false | "image" | "webgl" | "svg">(false);
  const [imgIdx, setImgIdx] = useState(0);
  const onReady = useCallback((m: "webgl" | "svg") => setRendered(m), []);

  if (visual.kind === "image") {
    const img = visual.images[imgIdx % visual.images.length]!;
    return (
      <div className="visual-backdrop relative h-full w-full" data-testid="card-visual" data-visual-kind="image" data-rendered={rendered ? "true" : "false"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={img.url}
          src={img.url}
          alt={title}
          width={img.width}
          height={img.height}
          draggable={false}
          loading={live ? "eager" : "lazy"}
          onLoad={() => setRendered("image")}
          className="h-full w-full select-none object-cover"
          data-testid="card-image"
        />
        {visual.images.length > 1 && (
          <div className="absolute inset-x-0 top-2 flex justify-center gap-1">
            {visual.images.map((im, i) => (
              <button
                key={im.url}
                type="button"
                aria-label={`Show image ${i + 1} of ${visual.images.length}`}
                onClick={() => setImgIdx(i)}
                className={`h-1.5 w-6 rounded-full ${i === imgIdx % visual.images.length ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        )}
        {img.kind !== "photo" && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">
            {img.kind === "360" ? "360° view" : "CAD render"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="visual-backdrop relative h-full w-full"
      data-testid="card-visual"
      data-visual-kind="procedural"
      data-rendered={live ? (rendered ? "true" : "false") : "sketch"}
      data-render-mode={rendered || undefined}
    >
      {/* A placeholder sketch sits underneath so there is never a blank frame while WebGL starts up.
          If WebGL is unavailable, ProceduralRing shows the sketch itself, so the placeholder goes away. */}
      {!(live && rendered === "svg") && (
        <div
          className={`absolute inset-0 p-6 transition-opacity duration-300 ${live && rendered === "webgl" ? "opacity-0" : "opacity-100"}`}
          aria-hidden={live || undefined}
        >
          <RingSketch params={visual.params} />
        </div>
      )}
      {live && (
        <div className="absolute inset-0">
          <ProceduralRing params={visual.params} onReady={onReady} />
        </div>
      )}
      <span
        className="absolute left-2 top-2 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-sm backdrop-blur"
        data-testid="procedural-badge"
      >
        {PROCEDURAL_BADGE}
      </span>
    </div>
  );
}
