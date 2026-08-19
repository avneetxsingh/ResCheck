// SERVER ONLY — pulls in both vendor SDKs. Client code imports ./catalog.
import type { Provider, ProviderId } from "./types";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";

export type { Provider, ProviderId, ModelOption, Budgets, ProviderErrorKind } from "./types";
import { DEFAULT_PROVIDER, PROVIDER_IDS, isProviderId } from "./catalog";
export { DEFAULT_PROVIDER, PROVIDER_IDS, isProviderId } from "./catalog";

export const PROVIDERS: Record<ProviderId, Provider> = {
  gemini: geminiProvider,
  groq: groqProvider,
};

// Unknown ids resolve to null rather than silently falling back: a request
// naming a provider we do not have must be rejected, not quietly rerouted.
export function resolveProvider(id: unknown): Provider | null {
  return isProviderId(id) ? PROVIDERS[id] : null;
}

export function providerForModel(model: string): Provider | null {
  return PROVIDER_IDS.map((id) => PROVIDERS[id]).find((p) => p.models.some((m) => m.id === model)) ?? null;
}
