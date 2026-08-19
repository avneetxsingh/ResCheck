import { describe, it, expect } from "vitest";
import { PROVIDERS, PROVIDER_IDS, DEFAULT_PROVIDER, resolveProvider, isProviderId } from "@/lib/providers";

describe("provider registry", () => {
  it("every provider offers models and defaults to one of them", () => {
    for (const id of PROVIDER_IDS) {
      const p = PROVIDERS[id];
      expect(p.models.length).toBeGreaterThan(0);
      expect(p.models.some((m) => m.id === p.defaultModel)).toBe(true);
    }
  });

  it("the default provider exists in the registry", () => {
    expect(PROVIDERS[DEFAULT_PROVIDER]).toBeDefined();
  });

  it("rejects an unknown id instead of silently falling back", () => {
    expect(resolveProvider("openai")).toBeNull();
    expect(resolveProvider(undefined)).toBeNull();
    expect(isProviderId("groq")).toBe(true);
    expect(isProviderId("nope")).toBe(false);
  });

  it("gives each provider its own budgets", () => {
    // Gemini's free tier is far larger; identical budgets would mean the
    // abstraction is not actually reading them per provider.
    expect(PROVIDERS.gemini.budgets.resumeChars).toBeGreaterThan(
      PROVIDERS.groq.budgets.resumeChars
    );
  });
});

describe("classifyError — groq", () => {
  const c = (e: unknown) => PROVIDERS.groq.classifyError(e);

  it("maps 401 to auth", () => expect(c({ status: 401 }).kind).toBe("auth"));
  it("maps a real rejected-key response to auth", () => {
    // Verbatim from a real rejected call on 2026-08-18.
    expect(
      c({
        status: 401,
        message: '401 {"error":{"message":"Invalid API Key","type":"invalid_request_error","code":"invalid_api_key"}}',
      }).kind
    ).toBe("auth");
  });
  it("maps 404 to model_gone", () => expect(c({ status: 404 }).kind).toBe("model_gone"));
  it("maps a decommissioned-model 400 to model_gone", () => {
    expect(c({ status: 400, message: "model_not_found: llama-3.1-8b-instant" }).kind).toBe("model_gone");
  });
  it("does not treat an unrelated 400 as a dead model", () => {
    expect(c({ status: 400, message: "unsupported value for response_format" }).kind).toBe("failed");
  });
  it("reads retry-after on 429", () => {
    expect(c({ status: 429, headers: { "retry-after": "12" } })).toEqual({
      kind: "rate_limit",
      retryAfterSeconds: 12,
    });
  });
  it("reports no delay when 429 carries none", () => {
    expect(c({ status: 429 }).retryAfterSeconds).toBeUndefined();
  });
  it("treats 503 capacity shedding as transient with a pause", () => {
    expect(c({ status: 503 })).toEqual({ kind: "rate_limit", retryAfterSeconds: 6 });
  });
  it("falls through to failed", () => expect(c({ status: 500 }).kind).toBe("failed"));
});

describe("classifyError — gemini", () => {
  const c = (e: unknown) => PROVIDERS.gemini.classifyError(e);

  it("maps 403 to auth", () => expect(c({ status: 403 }).kind).toBe("auth"));
  it("maps a bad-key 400 to auth, not failed", () => {
    // Verbatim from a real rejected call on 2026-08-18. Gemini reports an
    // invalid key as 400 INVALID_ARGUMENT, not 401, so status alone would
    // misfile it as transient and burn a pointless retry.
    const real = {
      status: 400,
      message:
        '{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"API_KEY_INVALID","domain":"googleapis.com"}]}}',
    };
    expect(c(real).kind).toBe("auth");
  });
  it("maps an unknown model to model_gone", () => {
    expect(c({ status: 404, message: "models/gemini-x is not found" }).kind).toBe("model_gone");
  });
  it("keeps a transient 503 mentioning not found retryable, not a dead model", () => {
    // The point is that "not found" in a 5xx must never be read as a retired
    // model, which would end the analysis and send the user to Settings.
    const r = c({ status: 503, message: "backend not found, try again" });
    expect(r.kind).not.toBe("model_gone");
    expect(r.kind).toBe("rate_limit");
  });
  it("parses retryDelay out of a quota error", () => {
    expect(c({ status: 429, message: 'RESOURCE_EXHAUSTED {"retryDelay":"31s"}' })).toEqual({
      kind: "rate_limit",
      retryAfterSeconds: 31,
    });
  });
  it("reports undefined rather than guessing when no delay is given", () => {
    const r = c({ status: 429, message: "quota exceeded" });
    expect(r.kind).toBe("rate_limit");
    expect(r.retryAfterSeconds).toBeUndefined();
  });
  it("falls through to failed", () => expect(c({ status: 500 }).kind).toBe("failed"));
});

describe("gemini overload handling", () => {
  const c = (e: unknown) => PROVIDERS.gemini.classifyError(e);

  it("treats a real high-demand 503 as transient, not a hard failure", () => {
    // Verbatim from a real run on 2026-08-18. Classified "failed" this would
    // retry instantly against an overloaded model and fail again.
    const real = {
      status: 503,
      message:
        '{"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}}',
    };
    const r = c(real);
    expect(r.kind).toBe("rate_limit");
    expect(r.retryAfterSeconds).toBe(6);
  });

  it("still reports a genuine 500 as failed", () => {
    expect(c({ status: 500, message: "internal" }).kind).toBe("failed");
  });
});
