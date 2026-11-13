"use client";

import { useState, useTransition } from "react";
import { savePreferences, skipOnboarding } from "@/app/onboarding/actions";
import { stoneDims, stoneOutline } from "@/components/ring3d/geometry/outline";
import { METAL_SWATCH, STONE_SWATCH } from "@/components/ring3d/materials";
import {
  ANY,
  ANY_LABEL,
  BAND_PROFILES,
  BAND_STYLES,
  BUDGET_BANDS,
  CARAT_BANDS,
  CENTER_STONES,
  CLARITIES,
  COLOR_GROUPS,
  CUTS,
  METALS,
  ORIGINS,
  PRONG_LABELS,
  PRONGS,
  SETTINGS,
  SHAPES,
  type CenterStone,
  type Metal,
  type Range,
  type Shape,
  type StatedPrefs,
} from "@/lib/taxonomy";

type Option = { value: string; label: string; icon?: React.ReactNode };
type ListKey = { [K in keyof StatedPrefs]: StatedPrefs[K] extends string[] | typeof ANY ? K : never }[keyof StatedPrefs];

function ShapeIcon({ shape }: { shape: Shape }) {
  const { w, l } = stoneDims(shape, 1);
  const k = 14 / Math.max(w, l);
  const pts = stoneOutline(shape, w * k, l * k);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${(12 + x).toFixed(1)},${(12 - y).toFixed(1)}`).join(" ") + "Z";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path d={d} fill="#eef4fb" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

const Dot = ({ color }: { color: string }) => (
  <span className="inline-block h-4 w-4 rounded-full border border-black/10" style={{ background: color }} aria-hidden />
);

const opts = (values: readonly string[], label = (v: string) => v): Option[] => values.map((v) => ({ value: v, label: label(v) }));

function Chip({ selected, onClick, children, testId }: { selected: boolean; onClick: () => void; children: React.ReactNode; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-testid={testId}
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition active:scale-95 ${
        selected ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Question({ n, title, hint, children }: { n?: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface p-4 shadow-card">
      <h2 className="font-semibold text-ink">
        {n != null && <span className="text-accent">{n}. </span>}
        {title}
      </h2>
      <p className="mb-3 mt-0.5 text-xs text-ink-soft">{hint}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

export function OnboardingForm({ initial, editing }: { initial: StatedPrefs; editing: boolean }) {
  const [prefs, setPrefs] = useState<StatedPrefs>(initial);
  const [pending, start] = useTransition();
  const [more, setMore] = useState(false);

  const multi = (key: ListKey, options: Option[], n?: number, title = "", hint = "Pick as many as you like.") => {
    const cur = prefs[key] as string[] | typeof ANY;
    const toggle = (v: string) => {
      const list = cur === ANY ? [] : [...cur];
      const next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
      setPrefs({ ...prefs, [key]: next.length ? next : ANY });
    };
    return (
      <Question n={n} title={title} hint={hint}>
        <Chip selected={cur === ANY} onClick={() => setPrefs({ ...prefs, [key]: ANY })} testId={`chip-${key}-any`}>
          {ANY_LABEL}
        </Chip>
        {options.map((o) => (
          <Chip key={o.value} selected={cur !== ANY && cur.includes(o.value)} onClick={() => toggle(o.value)} testId={`chip-${key}-${o.value}`}>
            {o.icon}
            {o.label}
          </Chip>
        ))}
      </Question>
    );
  };

  const band = (key: "budget" | "carat", bands: readonly { id: string; label: string; min: number; max: number }[], n: number, title: string) => {
    const cur = prefs[key] as Range | typeof ANY;
    const isSel = (b: { min: number; max: number }) => cur !== ANY && cur.min === b.min && cur.max === b.max;
    return (
      <Question n={n} title={title} hint="Pick one.">
        <Chip selected={cur === ANY} onClick={() => setPrefs({ ...prefs, [key]: ANY })} testId={`chip-${key}-any`}>
          {ANY_LABEL}
        </Chip>
        {bands.map((b) => (
          <Chip key={b.id} selected={isSel(b)} onClick={() => setPrefs({ ...prefs, [key]: { min: b.min, max: b.max } })} testId={`chip-${key}-${b.id}`}>
            {b.label}
          </Chip>
        ))}
      </Question>
    );
  };

  const origin = (
    <Question n={5} title="Natural or lab-grown?" hint="Pick one.">
      <Chip selected={prefs.origin === ANY} onClick={() => setPrefs({ ...prefs, origin: ANY })} testId="chip-origin-any">
        {ANY_LABEL}
      </Chip>
      {ORIGINS.map((o) => (
        <Chip key={o} selected={prefs.origin === o} onClick={() => setPrefs({ ...prefs, origin: o })} testId={`chip-origin-${o}`}>
          {o}
        </Chip>
      ))}
    </Question>
  );

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="onboarding"
      onSubmit={(e) => {
        e.preventDefault();
        start(() => savePreferences(JSON.stringify(prefs)));
      }}
    >
      {multi("shapes", SHAPES.map((s) => ({ value: s, label: s, icon: <ShapeIcon shape={s} /> })), 1, "Which stone shapes catch your eye?")}
      {multi("metals", METALS.map((m) => ({ value: m, label: m, icon: <Dot color={METAL_SWATCH[m as Metal]} /> })), 2, "Which metal colours?")}
      {multi("settings", opts(SETTINGS), 3, "Which setting styles?")}
      {multi("centerStones", CENTER_STONES.map((c) => ({ value: c, label: c, icon: <Dot color={STONE_SWATCH[c as CenterStone]} /> })), 4, "Which centre stone?")}
      {origin}
      {band("budget", BUDGET_BANDS, 6, "What's your budget?")}
      {band("carat", CARAT_BANDS, 7, "Roughly what size of centre stone?")}

      <button type="button" onClick={() => setMore(!more)} className="self-start text-sm font-semibold text-accent" aria-expanded={more}>
        {more ? "Hide extra details" : "More details (optional) ▾"}
      </button>
      {more && (
        <>
          {multi("colorGroups", opts(Object.keys(COLOR_GROUPS), (g) => `${g} (${COLOR_GROUPS[g as keyof typeof COLOR_GROUPS].join("–").replace(/–.*–/, "–")})`), undefined, "Diamond colour")}
          {multi("clarities", opts(CLARITIES), undefined, "Clarity")}
          {multi("cuts", opts(CUTS), undefined, "Cut grade")}
          {multi("prongs", opts(PRONGS, (p) => PRONG_LABELS[p as keyof typeof PRONG_LABELS]), undefined, "Prong style")}
          {multi("bandStyles", opts(BAND_STYLES, (b) => (b === "Pavé" ? "Pavé (sparkly) band" : "Plain band")), undefined, "Band")}
          {multi("bandProfiles", opts(BAND_PROFILES), undefined, "Band shape")}
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-canvas/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => skipOnboarding())}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-ink-soft"
            data-testid="onboarding-skip"
          >
            {editing ? "Clear all" : "Skip for now"}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-xl bg-accent px-5 py-3 font-semibold text-white active:scale-[0.98] disabled:opacity-60"
            data-testid="onboarding-submit"
          >
            {pending ? "Saving…" : editing ? "Save and show rings" : "Show me rings"}
          </button>
        </div>
      </div>
    </form>
  );
}
