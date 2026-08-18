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
  | "tense_inconsistency"
  | "extra_whitespace"
  | "inconsistent_bold"
  | "inconsistent_bullets"
  | "date_format"
  | "capitalization_inconsistency";

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

export interface SkillEvidence {
  kind: "exact" | "alias";
  sections: ResumeSection[];
  roles: { title: string; months: number; ended_at: string | null }[];
}

export interface Skill {
  name: string;
  present_in_resume: boolean;
  category: "technical" | "soft" | "domain" | "tool";
  match_strength: "exact" | "partial" | "missing";
  // Evidence fields — absent in history entries written before this change.
  strength?: "strong" | "moderate" | "weak" | "missing";
  evidence?: SkillEvidence | null;
  last_used_months_ago?: number | null;
  total_months?: number | null;
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

export interface FormattingAudit {
  whitespace_issues: string[];       // e.g. "Double space after period on line: 'Led a team  of 5'"
  bold_inconsistencies: string[];    // e.g. "Google is bold but Microsoft is not"
  bullet_inconsistencies: string[];  // e.g. "Most bullets start with '•' but one uses '-'"
  date_format_issues: string[];      // e.g. "Jan 2023 vs January 2023 vs 2023-01"
  capitalization_issues: string[];   // e.g. "Section header 'experience' should be 'Experience'"
  other_inconsistencies: string[];   // catch-all for anything else
  is_clean: boolean;                 // true only if ALL arrays are empty
}

export interface AtsContactInfo {
  email: string | null;
  phone: string | null;
  links: string[];
}

export interface AtsExtraction {
  sections_detected: string[]; // canonical ResumeSection names with a real heading found
  contact: AtsContactInfo;
  warnings: string[]; // parse warnings: garbled chars, missing contact, no headings
}

export interface AnalysisResult {
  scorecard: Scorecard;
  skills_gap: SkillsGapAnalysis;
  errors: LineError[];
  formatting_audit?: FormattingAudit; // optional — absent in pre-existing history entries
  ats_extraction?: AtsExtraction; // optional — absent in pre-v2 history entries
  warnings?: string[]; // degraded-stage warnings — absent in pre-v2 history entries
  summary: ExecutiveSummary;
  metadata: {
    model: string;
    analyzed_at: string; // ISO timestamp (added client-side)
    resume_word_count: number;
    jd_word_count: number;
    jd_quality?: "rich" | "moderate" | "sparse"; // optional — absent in pre-existing history entries
    total_errors_found: number;
    pipeline_version?: number; // 2 for the SSE multi-pass pipeline; absent pre-v2
  };
}

// Raw shape returned by Groq — client enriches with id + analyzed_at
export interface RawAnalysisResult {
  scorecard: Scorecard;
  skills_gap: SkillsGapAnalysis;
  errors: Omit<LineError, "id">[];
  formatting_audit: FormattingAudit;
  ats_extraction?: AtsExtraction;
  warnings?: string[];
  summary: ExecutiveSummary;
  metadata: Omit<AnalysisResult["metadata"], "analyzed_at">;
}
