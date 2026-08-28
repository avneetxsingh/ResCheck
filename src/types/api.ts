import type { AtsExtraction, ParseGate, RawAnalysisResult, RetrieveGate } from "./analysis";

export interface ParsePdfResponse {
  text: string;
  page_count: number;
  word_count: number;
}

export interface AnalyzeRequest {
  resume_text: string;
  job_description: string;
  // groq_api_key passed via header: "x-groq-api-key"
}

export interface AnalyzeResponse {
  result: RawAnalysisResult;
}

export type ApiErrorCode =
  | "INVALID_KEY"
  | "PARSE_FAILED"
  | "RATE_LIMITED"
  | "INVALID_JSON"
  | "INVALID_REQUEST"
  | "FREE_RUNS_EXHAUSTED"
  | "HOSTED_UNAVAILABLE"
  | "HOSTED_CAPACITY_EXHAUSTED"
  | "UNKNOWN";

export interface ApiError {
  error: string;
  code: ApiErrorCode;
}

export interface FreeRunsResponse {
  remaining: number;
  limit: number;
  // false when hosted analysis is not configured on this deployment at all.
  // Without this the client cannot tell "you have spent your free runs" from
  // "there were never any free runs here", and would tell a first-time visitor
  // they had used an allowance they never had.
  available: boolean;
}

// Streamed once, as soon as AI-1 resolves — roughly 1s into a run that takes
// 25-83s. It carries ONLY the gates that are final at that moment.
//
// Gate 2 (knockout) is deliberately absent. Its years-experience check and the
// competitiveness signals are computed from work history, which comes out of
// AI-2 — the slow stage. Emitting a knockout verdict here would mean deriving
// it from a subset of its inputs and possibly contradicting it seconds later,
// which invariant 1 forbids. The UI shows that gate as still resolving.
export interface PartialAnalysis {
  parse: ParseGate;
  retrieve: RetrieveGate;
  ats_extraction?: AtsExtraction;
  jd_quality?: "rich" | "moderate" | "sparse";
}
