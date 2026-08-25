import { describe, it, expect } from "vitest";
import { resolveAnalysisMode } from "../analysis-mode";
import { PROVIDERS, DEFAULT_PROVIDER } from "@/lib/providers";

const validHostedInput = {
  byoKey: "",
  legacyGroqHeaderOnly: false,
  bodyProvider: undefined,
  bodyModel: undefined,
  hostedKey: "hosted-secret-key",
  freeRunSecret: "0123456789abcdef", // 16 chars — passes the boundary
  hostedProvider: "groq",
};

describe("resolveAnalysisMode — hosted mode", () => {
  // MONEY-SAFETY TEST. A hosted request supplying a model in the body must
  // NOT get that model — it must always get the hosted provider's own
  // default, because the hosted key is the owner's, not the visitor's. If
  // this test ever fails, a stranger with no key can point the owner's key
  // at the most expensive model on the provider and the owner pays for it.
  it("ignores a body-supplied model and returns the hosted provider's default", () => {
    const result = resolveAnalysisMode({
      ...validHostedInput,
      bodyModel: "openai/gpt-oss-20b",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model).toBe(PROVIDERS.groq.defaultModel);
    expect(result.model).not.toBe("openai/gpt-oss-20b");
  });

  it("ignores a body-supplied provider and resolves from hostedProvider instead", () => {
    const result = resolveAnalysisMode({
      ...validHostedInput,
      hostedProvider: "groq",
      bodyProvider: "gemini",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider.id).toBe("groq");
    expect(result.usingHosted).toBe(true);
    expect(result.apiKey).toBe(validHostedInput.hostedKey);
  });

  it("refuses with HOSTED_UNAVAILABLE 503 when the hosted key is empty", () => {
    const result = resolveAnalysisMode({ ...validHostedInput, hostedKey: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("HOSTED_UNAVAILABLE");
    expect(result.status).toBe(503);
  });

  it("refuses with HOSTED_UNAVAILABLE 503 on a 15-character secret, but accepts 16", () => {
    const tooShort = resolveAnalysisMode({ ...validHostedInput, freeRunSecret: "0123456789abcde" });
    expect(tooShort.ok).toBe(false);
    if (!tooShort.ok) {
      expect(tooShort.code).toBe("HOSTED_UNAVAILABLE");
      expect(tooShort.status).toBe(503);
    }

    const justRight = resolveAnalysisMode({ ...validHostedInput, freeRunSecret: "0123456789abcdef" });
    expect(justRight.ok).toBe(true);
  });

  it("falls back to the app default provider when hostedProvider is unset or unknown", () => {
    const result = resolveAnalysisMode({ ...validHostedInput, hostedProvider: undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider.id).toBe(DEFAULT_PROVIDER);
  });
});

describe("resolveAnalysisMode — power user mode", () => {
  it("uses the caller's own key, provider and a known model exactly as requested", () => {
    const result = resolveAnalysisMode({
      byoKey: "sk-visitor-key",
      legacyGroqHeaderOnly: false,
      bodyProvider: "gemini",
      bodyModel: PROVIDERS.gemini.models[0].id,
      hostedKey: "",
      freeRunSecret: "",
      hostedProvider: undefined,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usingHosted).toBe(false);
    expect(result.provider.id).toBe("gemini");
    expect(result.model).toBe(PROVIDERS.gemini.models[0].id);
    expect(result.apiKey).toBe("sk-visitor-key");
  });

  it("rejects an unknown model with INVALID_REQUEST 400 and the brief's exact message", () => {
    const result = resolveAnalysisMode({
      byoKey: "sk-visitor-key",
      legacyGroqHeaderOnly: false,
      bodyProvider: "groq",
      bodyModel: "not-a-real-model",
      hostedKey: "",
      freeRunSecret: "",
      hostedProvider: undefined,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_REQUEST");
    expect(result.status).toBe(400);
    expect(result.error).toBe('Groq does not offer "not-a-real-model". Pick a different model in Settings.');
  });

  it("a legacy-header-only request resolves to Groq with its default model", () => {
    const result = resolveAnalysisMode({
      byoKey: "gsk_legacy-key",
      legacyGroqHeaderOnly: true,
      bodyProvider: undefined,
      bodyModel: undefined,
      hostedKey: "",
      freeRunSecret: "",
      hostedProvider: undefined,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usingHosted).toBe(false);
    expect(result.provider.id).toBe("groq");
    expect(result.model).toBe(PROVIDERS.groq.defaultModel);
  });

  it("a legacy-header request with a retired model falls back to the current default instead of 400ing", () => {
    const result = resolveAnalysisMode({
      byoKey: "gsk_legacy-key",
      legacyGroqHeaderOnly: true,
      bodyProvider: undefined,
      bodyModel: "llama-3.1-8b-instant", // retired 2026-08-16
      hostedKey: "",
      freeRunSecret: "",
      hostedProvider: undefined,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model).toBe(PROVIDERS.groq.defaultModel);
  });
});
