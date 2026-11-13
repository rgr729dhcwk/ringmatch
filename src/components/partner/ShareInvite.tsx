"use client";

import { useState } from "react";

/** Share or copy the invite: uses the phone's share sheet when available. */
export function ShareInvite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/partner?code=${encodeURIComponent(code)}`;
  const text = `Join me on RingMatch so we can find rings we both love! Make a profile, then open Partner and enter code ${code} — or open ${link}`;
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "RingMatch invite", text });
        return;
      }
    } catch {
      /* cancelled — fall back to copying */
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" onClick={share} className="rounded-xl bg-accent px-5 py-3 font-semibold text-white" data-testid="share-invite">
      {copied ? "Copied — paste it in a message" : "Share invite"}
    </button>
  );
}
