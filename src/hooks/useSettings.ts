"use client";

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_PROVIDER, PROVIDER_INFO as PROVIDERS, isProviderId } from "@/lib/providers/catalog";
import type { ProviderId } from "@/lib/providers/catalog";

export interface AppSettings {
  provider: ProviderId;
  // One key per provider, so holding both does not mean pasting one back and forth.
  apiKeys: Partial<Record<ProviderId, string>>;
  model: string;
  // Pipeline v2: prompts are server-owned and read-only in the UI; the stored
  // field remains for localStorage backward compatibility only.
  systemPrompt: string;
}

const STORAGE_KEY = "rescheck_settings";

const DEFAULTS: AppSettings = {
  provider: DEFAULT_PROVIDER,
  apiKeys: {},
  model: PROVIDERS[DEFAULT_PROVIDER].defaultModel,
  systemPrompt: "",
};

interface LegacySettings {
  apiKey?: string;
  provider?: string;
  apiKeys?: Partial<Record<string, string>>;
  model?: string;
  systemPrompt?: string;
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS, apiKeys: {} };
    const parsed = JSON.parse(raw) as LegacySettings;

    // A stored single apiKey predates provider support, so it is a Groq key.
    // Pointing that user at Gemini would silently strand them without a key.
    const legacyKey = typeof parsed.apiKey === "string" ? parsed.apiKey : "";
    const apiKeys: Partial<Record<ProviderId, string>> = {};
    for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
      const stored = parsed.apiKeys?.[id];
      if (typeof stored === "string" && stored) apiKeys[id] = stored;
    }
    if (legacyKey && !apiKeys.groq) apiKeys.groq = legacyKey;

    const provider = isProviderId(parsed.provider)
      ? parsed.provider
      : legacyKey
        ? "groq"
        : DEFAULTS.provider;

    // A model ID is only trusted while its provider still serves it. This is
    // the check that made the 2026-08-16 Groq shutdown recoverable.
    const known = PROVIDERS[provider].models.some((m) => m.id === parsed.model);
    const model = known && parsed.model ? parsed.model : PROVIDERS[provider].defaultModel;

    return { provider, apiKeys, model, systemPrompt: parsed.systemPrompt ?? "" };
  } catch {
    return { ...DEFAULTS, apiKeys: {} };
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>({ ...DEFAULTS, apiKeys: {} });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadSettings();
    // Storage can throw outright — site data blocked for the origin, or quota
    // exhausted. Unguarded, this effect threw before setHydrated, and an
    // uncaught error in a client effect takes the whole tree to the global
    // error page: the app became unusable rather than merely unable to
    // remember anything. Degrade to in-memory settings instead.
    try {
      // Migrate the pre-provider standalone key, then retire it.
      const oldKey = localStorage.getItem("rescheck_api_key");
      if (oldKey && !loaded.apiKeys.groq) {
        loaded.apiKeys = { ...loaded.apiKeys, groq: oldKey };
        loaded.provider = "groq";
        loaded.model = PROVIDERS.groq.defaultModel;
      }
      if (oldKey) localStorage.removeItem("rescheck_api_key");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
    } catch {
      // Nothing to do — the session works, it just will not persist.
    }
    setSettingsState(loaded);
    setHydrated(true);
  }, []);

  // Writing inside the state updater ran the write twice under StrictMode and
  // put a side effect in a function contracted to be pure. Persisting is also
  // allowed to fail (blocked storage, full quota) without losing the change
  // in memory — the session keeps working, it just will not be remembered.
  const persist = useCallback((next: AppSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // In-memory only from here.
    }
  }, []);

  const saveSettings = useCallback(
    (updated: Partial<AppSettings>) => {
      setSettingsState((prev) => {
        const next = { ...prev, ...updated };
        queueMicrotask(() => persist(next));
        return next;
      });
    },
    [persist]
  );

  // Switching provider carries its own model, never the other provider's.
  const setProvider = useCallback(
    (provider: ProviderId) => {
      saveSettings({ provider, model: PROVIDERS[provider].defaultModel });
    },
    [saveSettings]
  );

  const setApiKey = useCallback(
    (provider: ProviderId, key: string) => {
      setSettingsState((prev) => {
        const next = { ...prev, apiKeys: { ...prev.apiKeys, [provider]: key } };
        queueMicrotask(() => persist(next));
        return next;
      });
    },
    [persist]
  );

  const resetAll = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Blocked storage — the in-memory reset below still happens.
    }
    setSettingsState({ ...DEFAULTS, apiKeys: {} });
  }, []);

  const activeProvider = PROVIDERS[settings.provider];
  const apiKey = settings.apiKeys[settings.provider] ?? "";
  const isModelCustomized = settings.model !== activeProvider.defaultModel;

  return {
    settings,
    activeProvider,
    apiKey,
    saveSettings,
    setProvider,
    setApiKey,
    resetAll,
    hydrated,
    isModelCustomized,
    defaults: DEFAULTS,
  };
}
