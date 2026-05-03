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
  | "UNKNOWN";

export interface ApiError {
  error: string;
  code: ApiErrorCode;
}
