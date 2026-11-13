"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { saveListingAction, type FormState } from "@/app/admin/actions";
import {
  BAND_PROFILES,
  BAND_STYLES,
  CENTER_STONES,
  CLARITIES,
  COLORS,
  CUTS,
  METALS,
  ORIGINS,
  PRONG_LABELS,
  PRONGS,
  SETTINGS,
  SHAPES,
} from "@/lib/taxonomy";

type Props = { initial: Record<string, string>; editing: boolean };

const input = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-accent";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

function Pick({ name, label, options, value, labels }: { name: string; label: string; options: readonly string[]; value?: string; labels?: Record<string, string> }) {
  return (
    <Field label={label}>
      <select name={name} defaultValue={value ?? ""} className={input} data-testid={`field-${name}`}>
        <option value="">Unknown</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
    </Field>
  );
}

const OUTCOME_TEXT = {
  accepted: { title: "Saved", tone: "bg-like/10 text-ink" },
  fell_back_procedural: { title: "Saved with a 3D style preview", tone: "bg-revisit/10 text-ink" },
  rejected: { title: "Not saved", tone: "bg-red-50 text-red-800" },
} as const;

export function ListingForm({ initial, editing }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveListingAction, { values: initial });
  const v = state.values ?? initial;
  // Re-mount the fields when the form comes back from the server so defaults reflect what was saved.
  const formKey = JSON.stringify(v);
  // After saving, bring the result into view (on a phone you're scrolled down at the Save button).
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.result || state.error) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <div ref={resultRef} className="scroll-mt-4" />
      {state.error && (
        <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800" data-testid="save-result" data-outcome="error">
          Not saved: {state.error}
        </p>
      )}
      {state.result && (
        <div role="status" className={`rounded-2xl p-4 text-sm ${OUTCOME_TEXT[state.result.outcome].tone}`} data-testid="save-result" data-outcome={state.result.outcome}>
          <p className="font-semibold">{OUTCOME_TEXT[state.result.outcome].title}</p>
          {state.result.outcome === "accepted" && (
            <p>
              {state.result.imagesKept} photo{state.result.imagesKept === 1 ? "" : "s"} passed the check and will be shown.
            </p>
          )}
          {state.result.outcome === "fell_back_procedural" && (
            <p>No usable photo, so this ring will show an illustrative 3D render built from its details.</p>
          )}
          {state.result.outcome === "rejected" && <p>{state.result.reason}</p>}
          {state.result.imageFailures.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs" data-testid="image-failures">
              {state.result.imageFailures.map((f) => (
                <li key={f.url} className="break-all">
                  Photo skipped — {f.reason}: {f.url}
                </li>
              ))}
            </ul>
          )}
          {state.result.listingId && (
            <p className="mt-2 flex gap-4 text-xs font-semibold">
              <Link href="/admin" className="text-accent">
                Back to listings
              </Link>
              <Link href="/admin/listings/new" className="text-accent">
                Add another
              </Link>
            </p>
          )}
        </div>
      )}

      <form key={formKey} action={action} className="flex flex-col gap-4" data-testid="listing-form">
        <input type="hidden" name="externalId" value={v.externalId ?? ""} />
        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-card">
          <h2 className="font-semibold text-ink">The listing</h2>
          <Field label="Title *">
            <input name="title" required defaultValue={v.title} className={input} placeholder="e.g. 1.5 ct oval halo engagement ring" data-testid="field-title" />
          </Field>
          <Field label="Shop / jeweller *">
            <input name="retailer" required defaultValue={v.retailer} className={input} placeholder="e.g. Blue Nile" data-testid="field-retailer" />
          </Field>
          <Field label="Link to the listing *" hint="Shown as “View listing” on the card.">
            <input name="sourceUrl" type="url" required defaultValue={v.sourceUrl} className={input} placeholder="https://…" data-testid="field-sourceUrl" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (USD)">
              <input name="price" inputMode="decimal" defaultValue={v.price} className={input} placeholder="e.g. 4250" data-testid="field-price" />
            </Field>
            <label className="mt-7 flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="priceIsEstimate" defaultChecked={v.priceIsEstimate === "on"} className="h-4 w-4" />
              Price is an estimate
            </label>
          </div>
          <Field
            label="Photo links"
            hint="One image address per line (right-click a photo → “Copy image address”). Each is checked: it must load, be an image, and be at least 600px. Bad ones are skipped."
          >
            <textarea name="images" rows={4} defaultValue={v.images} className={input} placeholder="https://…/ring-front.jpg" data-testid="field-images" />
          </Field>
        </section>

        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-card">
          <h2 className="font-semibold text-ink">The ring</h2>
          <p className="-mt-2 text-xs text-ink-soft">
            Leave anything you don&apos;t know as “Unknown”. Shape or setting is needed if there are no usable photos (to draw a preview).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Pick name="shape" label="Shape" options={SHAPES} value={v.shape} />
            <Field label="Carat">
              <input name="caratWeight" inputMode="decimal" defaultValue={v.caratWeight} className={input} placeholder="e.g. 1.2" data-testid="field-caratWeight" />
            </Field>
            <Pick name="color" label="Colour" options={COLORS} value={v.color} />
            <Pick name="clarity" label="Clarity" options={CLARITIES} value={v.clarity} />
            <Pick name="cut" label="Cut" options={CUTS} value={v.cut} />
            <Pick name="origin" label="Natural / lab" options={ORIGINS} value={v.origin} />
            <Pick name="centerStone" label="Centre stone" options={CENTER_STONES} value={v.centerStone} />
            <Pick name="setting" label="Setting" options={SETTINGS} value={v.setting} />
            <Pick name="prongs" label="Prongs" options={PRONGS} value={v.prongs} labels={PRONG_LABELS} />
            <Pick name="metal" label="Metal" options={METALS} value={v.metal} />
            <Field label="Band width (mm)">
              <input name="bandWidthMm" inputMode="decimal" defaultValue={v.bandWidthMm} className={input} placeholder="e.g. 2" data-testid="field-bandWidthMm" />
            </Field>
            <Pick name="bandStyle" label="Band style" options={BAND_STYLES} value={v.bandStyle} />
            <Pick name="bandProfile" label="Band shape" options={BAND_PROFILES} value={v.bandProfile} />
          </div>
        </section>

        <button type="submit" disabled={pending} className="rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-60" data-testid="save-listing">
          {pending ? "Checking photos and saving…" : editing || v.externalId ? "Save changes" : "Save listing"}
        </button>
      </form>
    </div>
  );
}
