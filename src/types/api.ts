import type { RawAnalysisResult } from "./analysis";

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
