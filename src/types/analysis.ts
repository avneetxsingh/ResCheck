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
  // months is null when the role's dates did not parse — distinct from a role
  // that genuinely lasted zero months.
  roles: { title: string; months: number | null; ended_at: string | null }[];
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
  // Deleted 2026-08-19 — Gate 3's "surfaces for N of M searches" replaces it.
  // Optional so stored entries keep the value they were written with.
  overall_match_percentage?: number;
}

export interface ScorecardMetric {
  score: number; // 0-100 integer
  label: string;
  rationale: string;
  improvement_tip: string;
}

export interface Scorecard {
  grammar_score: ScorecardMetric;
  formatting_score: ScorecardMetric;
  impact_score: ScorecardMetric;
  // Deleted 2026-08-19 — no real system computes an overall ATS score, and the
  // funnel answers the other two honestly. Kept optional because every stored
  // history entry still carries them and must render unchanged.
  overall_ats_score?: ScorecardMetric;
  skills_match_score?: ScorecardMetric;
  keyword_density_score?: ScorecardMetric;
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

// ── Screening funnel ──────────────────────────────────────────────────────
// Three gates that have honest answers, replacing the invented overall score.
// Every one of these is optional on AnalysisResult: entries stored before the
// funnel have none of it and must still render.
export type ParseVerdict = "clean" | "risky" | "likely_breaks";
export type GateVerdict = "pass" | "fail" | "unverifiable";

export type RequirementType =
  | "degree"
  | "years_experience"
  | "certification"
  | "work_authorization"
  | "location";

// What the posting states, copied by the model. It never assesses the
// candidate — code performs every comparison against this record.
export interface JdRequirement {
  type: RequirementType;
  value: string;
  required: boolean;
}

export interface ParseGate {
  verdict: ParseVerdict;
  reasons: string[]; // verbatim from the parse warnings and formatting audit
}

export interface KnockoutCheck {
  type: RequirementType;
  value: string;
  required: boolean;
  verdict: GateVerdict;
  detail: string; // written for the user, not a stack trace
}

export interface KnockoutGate {
  verdict: GateVerdict;
  // false when the posting stated no hard requirements at all. Without this
  // the "pass" would read as a clearance the app never actually granted.
  stated: boolean;
  checks: KnockoutCheck[];
}

export interface RetrievalQuery {
  label: string; // "Kubernetes" or "React AND TypeScript"
  terms: string[];
  surfaces: boolean;
}

export interface RetrieveGate {
  queries: RetrievalQuery[];
  surfaced: number;
  total: number;
  misses: string[]; // labels of the queries that do not surface the resume
}

// Named factors with their values. Never combined into a score — combining
// them would reinvent the number the funnel exists to remove.
export interface CompetitivenessSignal {
  key:
    | "total_experience"
    | "skill_recency"
    | "avg_tenure"
    | "employment_gaps"
    | "unevidenced_skills";
  label: string;
  value: string;
  detail: string;
}

export interface FunnelResult {
  parse: ParseGate;
  knockout: KnockoutGate;
  retrieve: RetrieveGate;
  signals: CompetitivenessSignal[];
}

export type AmbushTrigger =
  | "failed_knockout"
  | "employment_gap"
  | "unevidenced_skill"
  | "short_tenure"
  | "stale_skill";

export interface AmbushQuestion {
  key: AmbushTrigger;
  /** Phrased as an interviewer would ask it. Code-owned; never model-generated. */
  question: string;
  /** Computed values only — never a claim about what a reader will think. */
  evidence: string[];
}

export interface AmbushKit {
  questions: AmbushQuestion[];
  /**
   * True when no role dates parsed, so gaps and tenure went unchecked. An empty
   * `questions` with this true means "not measured", NOT "nothing to ask" — the
   * consumer must render those two as different sentences.
   */
  dates_unreadable: boolean;
}

export interface AnalysisResult {
  scorecard: Scorecard;
  skills_gap: SkillsGapAnalysis;
  errors: LineError[];
  formatting_audit?: FormattingAudit; // optional — absent in pre-existing history entries
  ats_extraction?: AtsExtraction; // optional — absent in pre-v2 history entries
  funnel?: FunnelResult; // optional — absent in history entries written before the funnel
  ambush_kit?: AmbushKit; // optional — absent in history entries written before Phase 4
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
  funnel?: FunnelResult; // optional — absent in history entries written before the funnel
  ambush_kit?: AmbushKit; // optional — absent in history entries written before Phase 4
  warnings?: string[];
  summary: ExecutiveSummary;
  metadata: Omit<AnalysisResult["metadata"], "analyzed_at">;
}
