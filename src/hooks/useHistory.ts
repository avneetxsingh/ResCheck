"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getHistory,
  addHistoryEntry,
  removeHistoryEntry,
  clearHistory,
} from "@/lib/history-storage";
import type { HistoryEntry } from "@/types/history";

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const addEntry = useCallback((entry: HistoryEntry) => {
    addHistoryEntry(entry);
    setHistory(getHistory());
  }, []);

  const removeEntry = useCallback((id: string) => {
    removeHistoryEntry(id);
    setHistory((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    clearHistory();
    setHistory([]);
  }, []);

  return { history, addEntry, removeEntry, clearAll };
}
