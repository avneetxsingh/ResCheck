// Provider metadata with NO SDK imports. The settings UI and useSettings are
// client components; importing the adapters there would ship both vendor SDKs
// to the browser. Server code imports ./index for the callable providers.
import type { Budgets, ModelOption, ProviderId } from "./types";

export type { Budgets, ModelOption, ProviderId } from "./types";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  keyLabel: string;
  keyHint: string;
  keyUrl: string;
  keyPrefix: string;
  models: ModelOption[];
  defaultModel: string;
  budgets: Budgets;
}

// Groq retires model IDs on a rolling basis and a dead ID fails every call.
// llama-3.1-8b-instant and llama-3.3-70b-versatile were shut down 2026-08-16.
// Check console.groq.com/docs/deprecations before trusting an ID here.
export const GROQ_INFO: ProviderInfo = {
  id: "groq",
  label: "Groq",
  keyLabel: "Groq API key",
  keyHint: "console.groq.com/keys",
  keyUrl: "https://console.groq.com/keys",
  keyPrefix: "gsk_",
  models: [
    { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", note: "Fastest" },
    { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", note: "Slower · sharpest audit" },
  ],
  defaultModel: "openai/gpt-oss-20b",
  // The free tier is 6,000 tokens/minute, which is what these clips exist for.
  budgets: {
    resumeChars: 12_000,
    jdChars: 4_000,
    maxOutputTokens: { jdSkills: 500, lineAudit: 1_800, summary: 500 },
  },
};

// Generally-available Flash models only. A preview model ID is an outage
// waiting to happen — this repo already lost a day to a retired one.
export const GEMINI_INFO: ProviderInfo = {
  id: "gemini",
  label: "Google Gemini",
  keyLabel: "Google AI Studio API key",
  keyHint: "aistudio.google.com/apikey",
  keyUrl: "https://aistudio.google.com/apikey",
  keyPrefix: "AIza",
  models: [
    { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash", note: "Most capable" },
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", note: "Fastest" },
  ],
  defaultModel: "gemini-3.7-flash",
  // Free-tier headroom here is ~40x Groq's. Deliberately conservative against
  // the documented ~250K TPM: Google publishes per-account quota in AI Studio,
  // not as a fixed number, so these must never be shown to users as guarantees.
  budgets: {
    resumeChars: 40_000,
    jdChars: 20_000,
    // Generous because on Gemini 3 models thinking tokens are drawn from this
    // same allowance: too tight and the model thinks itself into an empty
    // response. Trivial against ~250K TPM.
    maxOutputTokens: { jdSkills: 4_000, lineAudit: 12_000, summary: 3_000 },
  },
};

export const PROVIDER_INFO: Record<ProviderId, ProviderInfo> = {
  gemini: GEMINI_INFO,
  groq: GROQ_INFO,
};

export const DEFAULT_PROVIDER: ProviderId = "gemini";

export const PROVIDER_IDS = Object.keys(PROVIDER_INFO) as ProviderId[];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && value in PROVIDER_INFO;
}
