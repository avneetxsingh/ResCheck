"use client";

// CLIENT ONLY (no node:crypto) — the localStorage side of the free-run
// corroboration hint. free-runs.ts owns the server-side signed cookie and
// cannot be imported here.
//
// One constant so the key name is never duplicated across the hooks that
// read and write it — a hint written under one string and read under a typo
// of it would silently stop corroborating anything.
export const FREE_RUNS_STORAGE_KEY = "rescheck_free_runs_used";

// Null covers both "never written" and "couldn't be read" (private mode,
// site data blocked) — callers already treat those the same way: fall back
// to the cookie alone.
export function readFreeRunsUsedHint(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(FREE_RUNS_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeFreeRunsUsedHint(used: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FREE_RUNS_STORAGE_KEY, String(used));
  } catch {
    // Site data blocked — degrade, never crash. See the localStorage
    // convention in CLAUDE.md.
  }
}
