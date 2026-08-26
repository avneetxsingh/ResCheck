// Pure mode/provider/model resolution for /api/analyze, split out of the
// route so the money-critical property — a hosted request can never choose
// its own provider or model — is a plain function a unit test can pin down,
// rather than something only provable by curling a live server with a real
// key (which this environment does not have).
import { DEFAULT_PROVIDER, PROVIDERS, resolveProvider } from "@/lib/providers";
import type { Provider } from "@/lib/providers";
import type { ApiErrorCode } from "@/types/api";

export interface AnalysisModeInput {
  byoKey: string; // already trimmed; "" means none supplied
  legacyGroqHeaderOnly: boolean;
  bodyProvider: string | undefined;
  bodyModel: string | undefined;
  hostedKey: string; // already trimmed
  freeRunSecret: string; // already trimmed
  // Read from process.env.HOSTED_PROVIDER by the caller, already trimmed —
  // kept out of this function's own env access so the function stays pure
  // and testable.
  hostedProvider: string | undefined;
}

export type AnalysisModeResult =
  | { ok: true; usingHosted: boolean; provider: Provider; model: string; apiKey: string }
  | { ok: false; error: string; code: ApiErrorCode; status: number };

export function resolveAnalysisMode(input: AnalysisModeInput): AnalysisModeResult {
  const usingHosted = input.byoKey.length === 0;

  if (usingHosted) {
    // No secret means we cannot meter, and running unmetered on our own key
    // is the one failure mode with an unbounded bill. Refuse instead.
    if (input.hostedKey.length === 0 || input.freeRunSecret.length < 16) {
      return {
        ok: false,
        error: "Free analyses aren't available right now. Add your own API key in Settings to keep going.",
        code: "HOSTED_UNAVAILABLE",
        status: 503,
      };
    }

    // MONEY-SAFETY INVARIANT: a hosted request never chooses its provider or
    // model. bodyProvider/bodyModel are intentionally never read on this
    // branch — honouring them would let any visitor with no key point our
    // key at the most expensive model on offer. Provider comes only from the
    // owner's HOSTED_PROVIDER env var (passed in as hostedProvider); model
    // is always that provider's own default.
    //
    // Unset is a real, documented fallback to the app default (.env.example
    // says so). A non-empty value that doesn't resolve is different: it means
    // the owner set HOSTED_PROVIDER to something and it didn't take (e.g. a
    // trailing newline from a platform env editor), so silently swapping in
    // the default would send the owner's key to the wrong provider and 401
    // every hosted run with no signal why. Refuse instead of guessing.
    const trimmedHostedProvider = input.hostedProvider ?? "";
    if (trimmedHostedProvider.length > 0) {
      const provider = resolveProvider(trimmedHostedProvider);
      if (!provider) {
        return {
          ok: false,
          error: "Free analyses aren't available right now. Add your own API key in Settings to keep going.",
          code: "HOSTED_UNAVAILABLE",
          status: 503,
        };
      }
      return { ok: true, usingHosted: true, provider, model: provider.defaultModel, apiKey: input.hostedKey };
    }
    const provider = PROVIDERS[DEFAULT_PROVIDER];
    return { ok: true, usingHosted: true, provider, model: provider.defaultModel, apiKey: input.hostedKey };
  }

  // Power User mode: unmetered, and it picks its own provider/model because
  // it is paying for them. Behaviour below is unchanged from the pre-hosted
  // route, including the legacy-header leniency.
  const provider =
    resolveProvider(input.bodyProvider) ??
    (input.legacyGroqHeaderOnly ? PROVIDERS.groq : PROVIDERS[DEFAULT_PROVIDER]);

  // A cached legacy bundle also sends the model default of its own era, which
  // the allowlist below no longer contains — so without this leniency every
  // legacy request 400'd on the model instead. Only the legacy path gets it:
  // an unknown model on a current request is still an error the user needs
  // to see.
  const requestedModel = input.bodyModel ?? provider.defaultModel;
  const modelIsKnown = provider.models.some((m) => m.id === requestedModel);
  const model = !modelIsKnown && input.legacyGroqHeaderOnly ? provider.defaultModel : requestedModel;
  if (!provider.models.some((m) => m.id === model)) {
    return {
      ok: false,
      error: `${provider.label} does not offer "${model}". Pick a different model in Settings.`,
      code: "INVALID_REQUEST",
      status: 400,
    };
  }

  return { ok: true, usingHosted: false, provider, model, apiKey: input.byoKey };
}
