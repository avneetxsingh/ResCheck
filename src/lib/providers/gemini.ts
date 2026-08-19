import { GoogleGenAI } from "@google/genai";
import type { ClassifiedError, CompletionRequest, CompletionResult, Provider } from "./types";
import { GEMINI_INFO } from "./catalog";
import { errMessage, errStatus } from "./types";

export const geminiProvider: Provider = {
  ...GEMINI_INFO,

  async complete(apiKey: string, req: CompletionRequest): Promise<CompletionResult> {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: req.model,
      contents: req.userPrompt,
      config: {
        systemInstruction: req.systemPrompt,
        temperature: req.temperature,
        maxOutputTokens: req.maxTokens,
        responseMimeType: "application/json",
        abortSignal: req.signal,
      },
    });
    const rawText = response.text ?? "";
    if (!rawText.trim()) {
      // Gemini 3 models think before answering, and thinking tokens are drawn
      // from maxOutputTokens — too small a budget yields an EMPTY response
      // rather than an error. Say so plainly instead of letting "" reach
      // JSON.parse and surface as an unexplained generic failure.
      const reason = response.candidates?.[0]?.finishReason ?? "unknown";
      throw new Error(
        `${req.model} returned no text (finishReason: ${reason}). The output budget was likely spent on thinking before any content was produced.`
      );
    }
    return { rawText, actualModel: response.modelVersion ?? req.model };
  },

  classifyError(err: unknown): ClassifiedError {
    const status = errStatus(err);
    const detail = errMessage(err);

    // Gemini reports a bad key as 400 INVALID_ARGUMENT, not 401, so status
    // alone would misfile it as a generic failure and burn a pointless retry.
    if (status === 401 || status === 403) return { kind: "auth" };
    if (status === 400 && /api[ _-]?key|invalid[ _-]?argument.*key|permission/i.test(detail)) {
      return { kind: "auth" };
    }
    // Scope the message match to statuses that actually mean "bad model": a
    // transient 503 mentioning "not found" must stay retryable.
    if (status === 404 || (status === 400 && /not found|is not supported|unsupported model/i.test(detail))) {
      return { kind: "model_gone" };
    }
    if (status === 429 || /resource[ _-]?exhausted|quota/i.test(detail)) {
      // RESOURCE_EXHAUSTED sometimes carries retryDelay ("31s"). Report a delay
      // only when the provider actually gave one — a guess is worse than none.
      const match = detail.match(/retryDelay["\s:]+(\d+(?:\.\d+)?)s/i);
      const seconds = match ? Number(match[1]) : NaN;
      return Number.isFinite(seconds) && seconds > 0
        ? { kind: "rate_limit", retryAfterSeconds: seconds }
        : { kind: "rate_limit" };
    }
    return { kind: "failed" };
  },
};
