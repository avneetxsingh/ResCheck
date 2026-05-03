"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "rescheck_api_key";

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    setApiKeyState(stored);
    setHydrated(true);
  }, []);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    if (key) {
      localStorage.setItem(STORAGE_KEY, key);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearApiKey = useCallback(() => {
    setApiKeyState("");
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    apiKey,
    setApiKey,
    clearApiKey,
    hasKey: apiKey.length > 0,
    hydrated,
  };
}
