import Groq from "groq-sdk";
import type { ClassifiedError, CompletionRequest, CompletionResult, Provider } from "./types";
import { GROQ_INFO } from "./catalog";
import { errMessage, errStatus } from "./types";

export const groqProvider: Provider = {
  ...GROQ_INFO,

  async complete(apiKey: string, req: CompletionRequest): Promise<CompletionResult> {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create(
      {
        model: req.model,
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: req.temperature,
        max_tokens: req.maxTokens,
      },
      { signal: req.signal }
    );
    return {
      rawText: completion.choices[0]?.message?.content ?? "",
      actualModel: completion.model ?? req.model,
    };
  },

  classifyError(err: unknown): ClassifiedError {
    const status = errStatus(err);
    const detail = errMessage(err);

    if (status === 401) return { kind: "auth" };
    // A retired or unknown model fails identically on every retry. Match only
    // model-specific phrasing: Groq also returns 400 for unsupported parameters.
    if (status === 404 || (status === 400 && /decommission|model_not_found|does not exist/i.test(detail))) {
      return { kind: "model_gone" };
    }
    // Capacity shedding, not quota — transient, but needs a pause before retry.
    if (status === 503 || status === 502) {
      return { kind: "rate_limit", retryAfterSeconds: 6 };
    }
    if (status === 429) {
      const headers =
        err && typeof err === "object"
          ? ((err as Record<string, unknown>).headers as Record<string, string> | undefined)
          : undefined;
      const retryAfter = Number(headers?.["retry-after"] ?? NaN);
      return Number.isFinite(retryAfter) && retryAfter > 0
        ? { kind: "rate_limit", retryAfterSeconds: retryAfter }
        : { kind: "rate_limit" };
    }
    return { kind: "failed" };
  },
};
