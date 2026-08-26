"use client";

import { useState, useEffect, useCallback } from "react";
import type { FreeRunsResponse } from "@/types/api";
import { readFreeRunsUsedHint, writeFreeRunsUsedHint } from "@/lib/free-runs-storage";

// `remaining` is null until the first successful read. Consumers must render
// something honest for null rather than assuming a number — showing "2 free
// runs" to a visitor who has none left is exactly the kind of small lie this
// product does not tell.
// Similarly, `available` is null until the server answers — a failed fetch is
// not evidence the feature is unconfigured, only that we couldn't ask.
export function useFreeRuns() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState(2);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Corroborates the cookie the same way /api/analyze does — without
        // this header GET could report a count the very next analyze call
        // enforces differently.
        const headers: Record<string, string> = {};
        const hint = readFreeRunsUsedHint();
        if (hint) headers["x-free-runs-used"] = hint;
        const res = await fetch("/api/free-runs", { headers });
        if (!res.ok) return;
        const data: FreeRunsResponse = await res.json();
        if (cancelled) return;
        setRemaining(data.remaining);
        setLimit(data.limit);
        setAvailable(data.available);
      } catch {
        // Offline or blocked. Leaving remaining and available at null is
        // correct: we do not know, so the UI must not claim a number or a
        // deployment state that the client was never asked about.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refund = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      const hint = readFreeRunsUsedHint();
      if (hint) headers["x-free-runs-used"] = hint;
      const res = await fetch("/api/free-runs", { method: "POST", headers });
      if (!res.ok) return;
      const data: FreeRunsResponse = await res.json();
      setRemaining(data.remaining);
      // The server-side refund clears the free-run cookie's stale hint by
      // rewriting it, but only in the cookie — without this the localStorage
      // hint stays at the pre-refund count and outranks the refunded cookie
      // on the very next request, silently undoing the refund it exists for.
      writeFreeRunsUsedHint(data.limit - data.remaining);
    } catch {
      // A failed refund costs the visitor one run. Nothing useful to do here.
    }
  }, []);

  return { remaining, limit, available, hydrated, setRemaining, refund };
}
