// Provider contract. The route knows these four error kinds and nothing about
// any vendor's error shape — that translation is each adapter's job, so a new
// provider never means editing the route.

export type ProviderId = "gemini" | "groq";

// "rate_limit" means transient-and-worth-waiting: quota exhaustion AND
// capacity overload both land here, because the useful response is the same.
export type ProviderErrorKind = "auth" | "rate_limit" | "model_gone" | "failed";

export interface ClassifiedError {
  kind: ProviderErrorKind;
  // Only set when the provider actually told us how long to wait. A guess here
  // would be worse than no value, so adapters must leave it undefined.
  retryAfterSeconds?: number;
}

export interface ModelOption {
  id: string;
  label: string;
  note: string;
}

export interface Budgets {
  // Input clips, in characters (~4 chars/token). These exist to fit a free-tier
  // tokens-per-minute ceiling, so they belong to the provider, not the pipeline.
  resumeChars: number;
  jdChars: number;
  // Slice of the posting handed to the writing audit for targeting.
  jdContextChars: number;
  maxOutputTokens: { jdSkills: number; lineAudit: number; summary: number };
  // Line errors the audit may return. Each costs ~70 output tokens, so asking
  // for more than the output cap can hold truncates the JSON and the whole
  // call is rejected — better to ask for fewer and get them all.
  maxErrors: number;
}

export interface CompletionRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  signal: AbortSignal;
}

export interface CompletionResult {
  rawText: string;
  actualModel: string;
}

export interface Provider {
  id: ProviderId;
  label: string;
  keyLabel: string;
  keyHint: string;
  keyUrl: string;
  keyPrefix: string; // how that vendor's keys start, for a validity hint only
  models: ModelOption[];
  defaultModel: string;
  budgets: Budgets;
  complete(apiKey: string, req: CompletionRequest): Promise<CompletionResult>;
  classifyError(err: unknown): ClassifiedError;
}

// Shared helpers for adapters reading loosely-typed SDK errors.
export function errStatus(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const status = (err as Record<string, unknown>).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

export function errMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const m = (err as Record<string, unknown>).message;
    if (typeof m === "string") return m;
  }
  return "";
}
