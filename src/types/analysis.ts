export type ErrorType =
  | "grammar"
  | "spelling"
  | "punctuation"
  | "weak_verb"
  | "passive_voice"
  | "quantification_missing"
  | "vague_language"
  | "keyword_missing"
  | "formatting"
  | "ats_unfriendly"
  | "redundancy"
  | "tense_inconsistency";

export type ResumeSection =
  | "contact"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "other";

export interface LineError {
  id: string; // added client-side
  original_line: string; // verbatim from resume
  fixed_line: string;
  error_type: ErrorType;
  reason: string; // ≤20 words
  section: ResumeSection;
  severity: "critical" | "moderate" | "minor";
}

export interface Skill {
  name: string;
  present_in_resume: boolean;
  category: "technical" | "soft" | "domain" | "tool";
  match_strength: "exact" | "partial" | "missing";
}

export interface SkillsGapAnalysis {
  must_have: Skill[];
  nice_to_have: Skill[];
  bonus_skills: string[];
  overall_match_percentage: number;
}

export interface ScorecardMetric {
  score: number; // 0-100 integer
  label: string;
  rationale: string;
  improvement_tip: string;
}

export interface Scorecard {
  overall_ats_score: ScorecardMetric;
  skills_match_score: ScorecardMetric;
  grammar_score: ScorecardMetric;
  formatting_score: ScorecardMetric;
  impact_score: ScorecardMetric;
  keyword_density_score: ScorecardMetric;
}

export interface ExecutiveSummary {
  verdict: "strong" | "moderate" | "needs_work" | "critical";
  headline: string;
  top_strengths: string[]; // max 3
  top_improvements: string[]; // max 3
  tailoring_advice: string;
}

export interface AnalysisResult {
  scorecard: Scorecard;
  skills_gap: SkillsGapAnalysis;
  errors: LineError[];
  summary: ExecutiveSummary;
  metadata: {
    model: string;
    analyzed_at: string; // ISO timestamp (added client-side)
    resume_word_count: number;
    jd_word_count: number;
    total_errors_found: number;
  };
}

// Raw shape returned by Groq — client enriches with id + analyzed_at
export interface RawAnalysisResult {
  scorecard: Scorecard;
  skills_gap: SkillsGapAnalysis;
  errors: Omit<LineError, "id">[];
  summary: ExecutiveSummary;
  metadata: Omit<AnalysisResult["metadata"], "analyzed_at">;
}
