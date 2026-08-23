import type { HistoryEntry } from "@/types/history";

const STORAGE_KEY = "rescheck_history";
const MAX_ENTRIES = 20;

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

// Entries grew materially with the funnel and per-skill evidence, so a full
// quota is reachable — and an unguarded throw here would land at the end of an
// analysis the user just waited for, losing the result they can see on screen.
// Failing to save is survivable; crashing the view is not.
function write(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage blocked or full — the session keeps its result in memory.
  }
}

export function addHistoryEntry(entry: HistoryEntry): void {
  if (typeof window === "undefined") return;
  const history = getHistory();
  const updated = [entry, ...history].slice(0, MAX_ENTRIES);
  write(JSON.stringify(updated));
}

export function removeHistoryEntry(id: string): void {
  if (typeof window === "undefined") return;
  const history = getHistory().filter((e) => e.id !== id);
  write(JSON.stringify(history));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}
