import type { AnalysisResult } from "./analysis";

export interface HistoryEntry {
  id: string;
  created_at: string; // ISO timestamp
  job_title_hint: string; // first 80 chars of JD
  overall_score: number;
  result: AnalysisResult;
}
