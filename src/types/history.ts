import type { AnalysisResult } from "./analysis";

export interface HistoryEntry {
  id: string;
  created_at: string; // ISO timestamp
  job_title_hint: string; // first 80 chars of JD
  // Absent on entries written after the funnel — the overall score it recorded
  // no longer exists. HistoryCard shows the verdict for those.
  overall_score?: number;
  result: AnalysisResult;
}
