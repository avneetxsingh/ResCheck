"use client";

import { useState, useEffect, useCallback } from "react";
import type { FreeRunsResponse } from "@/types/api";

// `remaining` is null until the first successful read. Consumers must render
// something honest for null rather than assuming a number — showing "2 free
// runs" to a visitor who has none left is exactly the kind of small lie this
// product does not tell.
export function useFreeRuns() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState(2);
  const [available, setAvailable] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/free-runs");
        if (!res.ok) return;
        const data: FreeRunsResponse = await res.json();
        if (cancelled) return;
        setRemaining(data.remaining);
        setLimit(data.limit);
        setAvailable(data.available);
      } catch {
        // Offline or blocked. Leaving remaining at null is correct: we do not
        // know, so the UI must not claim a number.
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
      const res = await fetch("/api/free-runs", { method: "POST" });
      if (!res.ok) return;
      const data: FreeRunsResponse = await res.json();
      setRemaining(data.remaining);
    } catch {
      // A failed refund costs the visitor one run. Nothing useful to do here.
    }
  }, []);

  return { remaining, limit, available, hydrated, setRemaining, refund };
}
