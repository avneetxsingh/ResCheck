import type { HistoryEntry } from "@/types/history";

const STORAGE_KEY = "rescheck_history";
const MAX_ENTRIES = 20;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Entries are read back from localStorage, where they survive indefinitely and
// can be truncated by a failed write, skewed by an older build, or edited by
// anything else on the origin. A record that parses as JSON but is missing a
// field a component dereferences used to blank the entire page, so the shape
// is checked here rather than trusted.
//
// Only the fields AnalysisResult declares NON-optional are required. Optional
// ones (funnel, ats_extraction, formatting_audit, ambush_kit, warnings) are
// absent from older entries by design — see invariant 8.
export function isRenderableEntry(value: unknown): value is HistoryEntry {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string") return false;
  const result = value.result;
  if (!isObject(result)) return false;
  return (
    isObject(result.scorecard) &&
    isObject(result.skills_gap) &&
    Array.isArray(result.errors) &&
    isObject(result.summary) &&
    isObject(result.metadata)
  );
}

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Dropping a malformed entry loses one saved run; rendering it loses the
    // whole app. The trade is not close.
    return Array.isArray(parsed) ? parsed.filter(isRenderableEntry) : [];
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
