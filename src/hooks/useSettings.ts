"use client";

import { useState, useEffect, useCallback } from "react";
import { SYSTEM_PROMPT, DEFAULT_MODEL } from "@/lib/prompts";

export interface AppSettings {
  apiKey: string;
  model: string;
  systemPrompt: string;
}

const STORAGE_KEY = "rescheck_settings";

const DEFAULTS: AppSettings = {
  apiKey: "",
  model: DEFAULT_MODEL,
  systemPrompt: SYSTEM_PROMPT,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      apiKey: parsed.apiKey ?? DEFAULTS.apiKey,
      model: parsed.model ?? DEFAULTS.model,
      systemPrompt: parsed.systemPrompt ?? DEFAULTS.systemPrompt,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>({ ...DEFAULTS });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Migrate old standalone API key if present
    const oldKey = localStorage.getItem("rescheck_api_key");
    if (oldKey) {
      const loaded = loadSettings();
      if (!loaded.apiKey) loaded.apiKey = oldKey;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
      localStorage.removeItem("rescheck_api_key");
      setSettingsState(loaded);
    } else {
      setSettingsState(loadSettings());
    }
    setHydrated(true);
  }, []);

  const saveSettings = useCallback((updated: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...updated };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetPrompt = useCallback(() => {
    saveSettings({ systemPrompt: DEFAULTS.systemPrompt });
  }, [saveSettings]);

  const resetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSettingsState({ ...DEFAULTS });
  }, []);

  const isPromptCustomized = settings.systemPrompt !== DEFAULTS.systemPrompt;
  const isModelCustomized = settings.model !== DEFAULTS.model;

  return {
    settings,
    saveSettings,
    resetPrompt,
    resetAll,
    hydrated,
    isPromptCustomized,
    isModelCustomized,
    defaults: DEFAULTS,
  };
}
