import type { AnalysisResult, AmbushKit, FunnelResult } from "@/types/analysis";

/**
 * The optional fields are non-optional *here*. Invariant 8 bans non-null
 * assertions on `funnel` and `ambush_kit` because stored history entries can
 * lack them — but this literal always carries both, and saying so in the type
 * means no consumer has to assert it.
 */
type SampleResult = AnalysisResult & { funnel: FunnelResult; ambush_kit: AmbushKit };

/**
 * One complete example report, so a visitor can see the payoff without
 * uploading anything.
 *
 * It is a real `AnalysisResult`, not a mock-up of one: the landing page renders
 * it through the same components the product uses, so the preview cannot drift
 * from the thing it advertises. Every figure is internally consistent — the
 * counts shown beside it are what `buildAtsDimensions` and `summariseChecks`
 * derive from this object, which is what makes "25 of 29 checks" a fact about
 * this document rather than a number typed into a marketing page.
 *
 * The candidate is invented, and the frame says so wherever this is rendered.
 * The result is deliberately not flawless — it carries writing findings, a
 * stale skill, two unevidenced ones, and a knockout that cannot be verified —
 * because a sample where everything passes would be its own kind of dishonesty.
 */
export const SAMPLE_RESULT: SampleResult = {
  scorecard: {
    grammar_score: {
      score: 88,
      label: "Grammar",
      rationale: "Three writing findings across 219 words.",
      improvement_tip: "Replace the weak verbs flagged in the Writing tab.",
    },
    formatting_score: {
      score: 100,
      label: "Formatting",
      rationale: "No formatting inconsistencies found.",
      improvement_tip: "Nothing to change here.",
    },
    impact_score: {
      score: 74,
      label: "Impact",
      rationale: "Two bullets describe duties rather than results.",
      improvement_tip: "Quantify the outcome of the on-call and tooling work.",
    },
  },

  skills_gap: {
    must_have: [
      { name: "Go", present_in_resume: true, category: "technical", match_strength: "exact", strength: "strong" },
      { name: "Python", present_in_resume: true, category: "technical", match_strength: "exact", strength: "strong" },
      { name: "PostgreSQL", present_in_resume: true, category: "technical", match_strength: "exact", strength: "strong" },
      { name: "Kafka", present_in_resume: true, category: "technical", match_strength: "exact", strength: "moderate" },
      { name: "Kubernetes", present_in_resume: true, category: "tool", match_strength: "exact", strength: "weak" },
      { name: "Terraform", present_in_resume: true, category: "tool", match_strength: "exact", strength: "weak" },
    ],
    nice_to_have: [
      { name: "AWS", present_in_resume: true, category: "tool", match_strength: "exact", strength: "weak" },
      { name: "Datadog", present_in_resume: true, category: "tool", match_strength: "exact", strength: "moderate" },
      { name: "Grafana", present_in_resume: true, category: "tool", match_strength: "exact", strength: "weak" },
      { name: "Rust", present_in_resume: false, category: "technical", match_strength: "missing", strength: "missing" },
      { name: "gRPC", present_in_resume: false, category: "technical", match_strength: "missing", strength: "missing" },
      { name: "Protocol Buffers", present_in_resume: false, category: "technical", match_strength: "missing", strength: "missing" },
      { name: "payments ledgering", present_in_resume: false, category: "domain", match_strength: "missing", strength: "missing" },
    ],
    bonus_skills: ["Java", "SQL", "TypeScript", "Redis", "Docker", "EC2", "S3", "RDS", "Lambda"],
  },

  errors: [
    {
      id: "sample-1",
      error_type: "weak_verb",
      section: "summary",
      severity: "moderate",
      original_line: "Responsible for payment infrastructure serving 2M daily transactions.",
      fixed_line: "Owned payment infrastructure serving 2M daily transactions.",
      reason: "“Responsible for” describes a duty; a verb of ownership describes what you did.",
    },
    {
      id: "sample-2",
      error_type: "weak_verb",
      section: "experience",
      severity: "moderate",
      original_line: "Was responsible for the on-call rotation across a team of nine engineers",
      fixed_line: "Ran the on-call rotation for nine engineers",
      reason: "The passive construction hides that you owned the rotation.",
    },
    {
      id: "sample-3",
      error_type: "vague_language",
      section: "experience",
      severity: "moderate",
      original_line: "Worked on various improvements to the internal deployment tooling",
      fixed_line: "Cut deploy time from 20 to 6 minutes in the internal tooling",
      reason: "“Various improvements” gives a reader nothing to weigh.",
    },
  ],

  formatting_audit: {
    whitespace_issues: [],
    bold_inconsistencies: [],
    bullet_inconsistencies: [],
    date_format_issues: [],
    capitalization_issues: [],
    other_inconsistencies: [],
    is_clean: true,
  },

  ats_extraction: {
    sections_detected: ["summary", "experience", "skills", "education", "projects"],
    contact: {
      email: "priya.raghunathan@example.com",
      phone: "(415) 555-0182",
      links: ["linkedin.com/in/example", "github.com/example"],
    },
    warnings: [],
    sections_missing: [],
    sections_unrecognized: [],
    column_evidence: [],
  },

  funnel: {
    parse: { verdict: "clean", reasons: [] },
    knockout: {
      verdict: "unverifiable",
      stated: true,
      checks: [
        {
          type: "degree",
          value: "Bachelor's degree in Computer Science",
          required: true,
          verdict: "pass",
          detail: "Your education section shows an equal or higher degree.",
        },
        {
          type: "years_experience",
          value: "6",
          required: true,
          verdict: "pass",
          detail: "8y 9m of dated experience against the 6 years this posting asks for.",
        },
        {
          type: "work_authorization",
          value: "Authorized to work in the US without sponsorship",
          required: true,
          verdict: "unverifiable",
          detail:
            "A résumé doesn't state work authorization, and ResCheck never sees the application form — the form will ask this, so check it yourself.",
        },
      ],
    },
    retrieve: {
      queries: [],
      surfaced: 9,
      total: 9,
      misses: [],
    },
    signals: [
      {
        key: "total_experience",
        label: "Total dated experience",
        value: "8y 9m",
        detail:
          "The posting asks for 6 years. Length of experience is the most common thing a recruiter sorts on.",
      },
      {
        key: "skill_recency",
        label: "Required skills last used over 2 years ago",
        value: "1",
        detail: "Kafka — a stale skill sorts below the same skill used recently.",
      },
      {
        key: "avg_tenure",
        label: "Average time per role",
        value: "2y 11m",
        detail: "Short average tenure is a common stability screen.",
      },
      {
        key: "unevidenced_skills",
        label: "Required skills listed but not evidenced",
        value: "2",
        detail:
          "Kubernetes, Terraform appear in a list with no dated role behind them — that reads as keyword stuffing.",
      },
    ],
  },

  ambush_kit: {
    dates_unreadable: false,
    questions: [
      {
        key: "unevidenced_skill",
        question: "You list Kubernetes, but no dated role shows it. Where did you use it?",
        evidence: ["Kubernetes appears in your résumé", "No dated role evidences it"],
      },
      {
        key: "unevidenced_skill",
        question: "You list Terraform, but no dated role shows it. Where did you use it?",
        evidence: ["Terraform appears in your résumé", "No dated role evidences it"],
      },
      {
        key: "stale_skill",
        question: "You list Kafka, but the last role using it ended 5y 1m ago. How current are you?",
        evidence: ["Kafka last evidenced 5y 1m ago"],
      },
    ],
  },

  summary: {
    verdict: "moderate",
    headline:
      "The résumé parses cleanly, meets the degree and experience requirements, and appears in all recruiter searches, but writing quality needs improvement",
    top_strengths: [
      "Clean parse of the résumé",
      "Meets degree and experience requirements (8y 9m vs 6 years)",
      "Surfaces for 9 of 9 recruiter searches",
    ],
    top_improvements: [
      "Replace “Responsible for” and “Was responsible for” with verbs that show ownership",
      "Quantify the deployment-tooling bullet — “various improvements” gives a reader nothing to weigh",
      "Evidence Kubernetes and Terraform inside a dated role, or drop them from the skills list",
    ],
    tailoring_advice:
      "Replace weak verbs with concrete action statements and quantify results to demonstrate ownership and impact.",
  },

  metadata: {
    model: "openai/gpt-oss-120b",
    analyzed_at: "2026-09-01T10:30:00.000Z",
    resume_word_count: 219,
    jd_word_count: 243,
    jd_quality: "rich",
    total_errors_found: 3,
    pipeline_version: 2,
  },
};
