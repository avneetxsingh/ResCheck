import Groq from "groq-sdk";
import type { ClassifiedError, CompletionRequest, CompletionResult, Provider } from "./types";
import { GROQ_INFO } from "./catalog";
import { errMessage, errStatus } from "./types";

export const groqProvider: Provider = {
  ...GROQ_INFO,

  async complete(apiKey: string, req: CompletionRequest): Promise<CompletionResult> {
    const groq = new Groq({ apiKey });
    // gpt-oss are reasoning models and reasoning tokens are drawn from
    // max_tokens. Left at Groq's default effort of "medium", reasoning consumes
    // the budget before the JSON is finished, and Groq rejects its own
    // truncated output as json_validate_failed — a 400, not a token error.
    // "hidden" keeps reasoning out of the content field; "raw" is rejected
    // outright when response_format is json_object.
    const params = {
      model: req.model,
      messages: [
        { role: "system" as const, content: req.systemPrompt },
        { role: "user" as const, content: req.userPrompt },
      ],
      response_format: { type: "json_object" as const },
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      reasoning_effort: "low",
      reasoning_format: "hidden",
    };
    // The param cast widens the return to the streaming union; stream is never
    // set, so narrow back to the shape actually returned.
    const completion = (await groq.chat.completions.create(
      params as unknown as Parameters<typeof groq.chat.completions.create>[0],
      { signal: req.signal }
    )) as { choices?: { message?: { content?: string | null } }[]; model?: string };
    return {
      rawText: completion.choices?.[0]?.message?.content ?? "",
      actualModel: completion.model ?? req.model,
    };
  },

  classifyError(err: unknown): ClassifiedError {
    const status = errStatus(err);
    const detail = errMessage(err);
    // json_validate_failed means the model produced unusable JSON, almost
    // always because reasoning exhausted max_tokens. Retrying at a different
    // temperature can genuinely help, so it stays a plain failure.
    if (/json_validate_failed|failed to (validate|generate) json/i.test(detail)) {
      return { kind: "failed" };
    }

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
