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

export function addHistoryEntry(entry: HistoryEntry): void {
  if (typeof window === "undefined") return;
  const history = getHistory();
  const updated = [entry, ...history].slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function removeHistoryEntry(id: string): void {
  if (typeof window === "undefined") return;
  const history = getHistory().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
