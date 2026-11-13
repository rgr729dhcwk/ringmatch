"use client";

import { useState, useTransition } from "react";
import { blendAction } from "@/app/partner/actions";

/** "Whose taste leads the deck?" — 0 = all my partner's, 100 = all mine. Saved when released. */
export function BlendSlider({ initial, partnerName }: { initial: number; partnerName: string }) {
  const [value, setValue] = useState(Math.round(initial * 100));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const label =
    value >= 80 ? "Mostly my taste" : value <= 20 ? `Mostly ${partnerName}'s taste` : value >= 60 ? "Leaning my way" : value <= 40 ? `Leaning ${partnerName}'s way` : "Both of us equally";
  const commit = () =>
    start(async () => {
      await blendAction(value / 100);
      setSaved(true);
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs font-semibold text-ink-soft">
        <span>{partnerName}</span>
        <span>Me</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => {
          setValue(Number(e.target.value));
          setSaved(false);
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={() => !saved && commit()}
        aria-label={`Whose taste leads the deck: ${label}`}
        aria-valuetext={label}
        className="w-full accent-[var(--color-accent)]"
        data-testid="blend-slider"
      />
      <p className="text-center text-sm font-semibold text-ink" data-testid="blend-label" data-saved={saved && !pending ? "1" : "0"}>
        {label}
        {pending ? " · saving…" : saved ? " · saved" : ""}
      </p>
    </div>
  );
}
