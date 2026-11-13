"use client";

import { useEffect, useState } from "react";

export const SHORTLIST_DELTA_EVENT = "ringmatch:shortlist-delta";

/** Live count in the header: the deck announces +1/−1 when a love/revisit is made or undone. */
export function ShortlistCount({ initial }: { initial: number }) {
  const [n, setN] = useState(initial);
  useEffect(() => {
    const on = (e: Event) => setN((x) => Math.max(0, x + (e as CustomEvent<number>).detail));
    window.addEventListener(SHORTLIST_DELTA_EVENT, on);
    return () => window.removeEventListener(SHORTLIST_DELTA_EVENT, on);
  }, []);
  return <span data-testid="shortlist-count">{n}</span>;
}
