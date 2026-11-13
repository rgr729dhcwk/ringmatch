"use client";

import { useActionState } from "react";
import { importAction, type ImportState } from "@/app/admin/actions";

const OUTCOME = { accepted: "saved", fell_back_procedural: "saved (3D preview)", rejected: "not saved" } as const;

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, {});
  return (
    <form action={action} className="flex flex-col gap-2" data-testid="import-form">
      <textarea
        name="json"
        rows={4}
        required
        placeholder='Paste an exported file here: { "listings": [ … ] }'
        className="w-full rounded-xl border border-line bg-white px-3 py-2 font-mono text-xs outline-none focus:border-accent"
        data-testid="import-json"
      />
      <button type="submit" disabled={pending} className="self-start rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink">
        {pending ? "Importing…" : "Import"}
      </button>
      {state.message && (
        <div role="status" className="text-sm text-ink" data-testid="import-result">
          <p>{state.message}</p>
          {state.results && state.results.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs text-ink-soft">
              {state.results.map((r, i) => (
                <li key={i}>
                  {r.title}: {OUTCOME[r.outcome as keyof typeof OUTCOME] ?? r.outcome}
                  {r.outcome === "rejected" && r.reason ? ` (${r.reason})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
