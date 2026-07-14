// Server-side deterministic scoring — the ground truth for every score the
// user sees. Brackets and weights are ported verbatim from pipeline v1;
// changing them is a product decision, not a refactor.
import type {
  ExecutiveSummary, FormattingAudit, LineError, Scorecard, ScorecardMetric, Skill,
} from "@/types/analysis";

export const AUDIT_KEYS = [
  "whitespace_issues",
  "bold_inconsistencies",
  "bullet_inconsistencies",
  "date_format_issues",
  "capitalization_issues",
  "other_inconsistencies",
] as const;

export interface ScoringInput {
  errors: Omit<LineError, "id">[];
  formattingAudit: FormattingAudit;
  mustHave: Skill[];
  niceToHave: Skill[];
}

export interface ScoringOutput {
  scorecard: Scorecard;
  verdict: ExecutiveSummary["verdict"];
  overallMatchPercentage: number;
}

const GRAMMAR_TYPES = new Set(["grammar", "spelling", "punctuation", "tense_inconsistency"]);
const IMPACT_TYPES = new Set(["quantification_missing", "weak_verb", "passive_voice", "vague_language"]);

function metric(score: number, label: string, rationale: string, tip: string): ScorecardMetric {
  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    label,
    rationale,
    improvement_tip: tip,
  };
}

function strengthRatio(skills: Skill[]): number {
  if (skills.length === 0) return 1.0;
  return (
    skills.reduce(
      (sum, s) => sum + (s.match_strength === "exact" ? 1 : s.match_strength === "partial" ? 0.5 : 0),
      0
    ) / skills.length
  );
}

export function computeScores(input: ScoringInput): ScoringOutput {
  const { errors, formattingAudit, mustHave, niceToHave } = input;

  // formatting — audit issue count brackets (v1 verbatim)
  const auditCount = AUDIT_KEYS.reduce((n, k) => n + formattingAudit[k].length, 0);
  const formattingScore =
    auditCount === 0 ? 95 : auditCount <= 2 ? 82 : auditCount <= 5 ? 67 : auditCount <= 10 ? 50 : 35;

  // grammar — error count brackets (v1 verbatim)
  const grammarCount = errors.filter((e) => GRAMMAR_TYPES.has(e.error_type)).length;
  const grammarScore = grammarCount === 0 ? 95 : grammarCount <= 3 ? 82 : grammarCount <= 7 ? 67 : 45;

  // impact — error count brackets (v1 verbatim)
  const impactCount = errors.filter((e) => IMPACT_TYPES.has(e.error_type)).length;
  const impactScore =
    impactCount === 0 ? 90 : impactCount <= 2 ? 75 : impactCount <= 5 ? 60 : impactCount <= 9 ? 45 : 30;

  // skills match — must-have 80%, nice-to-have 20% (v1 verbatim)
  const skillsScore = Math.round((strengthRatio(mustHave) * 0.8 + strengthRatio(niceToHave) * 0.2) * 100);

  // keyword density — present/total, 50 when no skills (v1 verbatim)
  const allSkills = [...mustHave, ...niceToHave];
  const presentCount = allSkills.filter((s) => s.present_in_resume).length;
  const keywordScore =
    allSkills.length === 0 ? 50 : Math.round((presentCount / allSkills.length) * 100);

  const overall = Math.round(
    skillsScore * 0.35 + keywordScore * 0.2 + impactScore * 0.2 + grammarScore * 0.15 + formattingScore * 0.1
  );

  const verdict: ExecutiveSummary["verdict"] =
    overall >= 80 ? "strong" : overall >= 65 ? "moderate" : overall >= 50 ? "needs_work" : "critical";

  const missingMust = mustHave.filter((s) => s.match_strength === "missing").map((s) => s.name);
  const exactCount = mustHave.filter((s) => s.match_strength === "exact").length;
  const partialCount = mustHave.filter((s) => s.match_strength === "partial").length;

  const scorecard: Scorecard = {
    overall_ats_score: metric(
      overall,
      "Overall ATS Score",
      "Weighted: skills 35%, keywords 20%, impact 20%, grammar 15%, formatting 10%.",
      missingMust.length > 0
        ? `The fastest gain is covering missing must-have skills: ${missingMust.slice(0, 3).join(", ")}.`
        : "Strengthen impact bullets with concrete numbers to push the score higher."
    ),
    skills_match_score: metric(
      skillsScore,
      "Skills Match",
      `${exactCount} of ${mustHave.length} must-have skills matched exactly, ${partialCount} partially.`,
      missingMust.length > 0
        ? `Add where truthful: ${missingMust.slice(0, 3).join(", ")}.`
        : "All must-have skills are covered — mirror the JD's exact wording where possible."
    ),
    grammar_score: metric(
      grammarScore,
      "Grammar & Language",
      `${grammarCount} language error(s) found (grammar, spelling, punctuation, tense).`,
      grammarCount > 0
        ? "Fix the flagged lines in the Errors tab — language errors read as carelessness to recruiters."
        : "No language errors found — keep it that way after edits."
    ),
    formatting_score: metric(
      formattingScore,
      "Formatting",
      `${auditCount} formatting inconsistenc${auditCount === 1 ? "y" : "ies"} detected by the deterministic audit.`,
      auditCount > 0
        ? "Resolve the items in the Formatting tab — each one quotes the exact text to fix."
        : "Formatting is consistent — no action needed."
    ),
    impact_score: metric(
      impactScore,
      "Impact & Quantification",
      `${impactCount} weak-impact line(s): weak verbs, passive voice, missing metrics, or vague claims.`,
      impactCount > 0
        ? "Rewrite flagged bullets: strong verb first, then a number (%, $, count, time saved)."
        : "Bullets are strong and quantified."
    ),
    keyword_density_score: metric(
      keywordScore,
      "Keyword Density",
      `${presentCount} of ${allSkills.length} JD skills appear in the resume text.`,
      presentCount < allSkills.length
        ? "Work absent JD keywords into real experience bullets — never keyword-stuff."
        : "Every JD skill appears at least once."
    ),
  };

  return { scorecard, verdict, overallMatchPercentage: skillsScore };
}

const VERDICT_HEADLINE: Record<ExecutiveSummary["verdict"], string> = {
  strong: "This resume is well matched to the role and should pass ATS screening.",
  moderate: "This resume is a reasonable match but has fixable gaps before applying.",
  needs_work: "This resume needs targeted fixes before it will screen well for this role.",
  critical: "This resume is unlikely to pass ATS screening for this role without major changes.",
};

// Used when the summary AI stage fails — every input here is deterministic,
// so the fallback is factual rather than generic.
export function buildFallbackSummary(
  out: ScoringOutput,
  mustHave: Skill[],
  errors: Omit<LineError, "id">[],
  bonusSkills: string[]
): ExecutiveSummary {
  const sc = out.scorecard;
  const missing = mustHave.filter((s) => s.match_strength === "missing").map((s) => s.name);
  const exact = mustHave.filter((s) => s.match_strength === "exact").map((s) => s.name);
  const critical = errors.filter((e) => e.severity === "critical");

  const strengths = [
    exact.length > 0 ? `Covers ${exact.length} must-have skill(s) exactly: ${exact.slice(0, 3).join(", ")}.` : null,
    sc.formatting_score.score >= 82 ? "Formatting is clean and consistent." : null,
    sc.grammar_score.score >= 82 ? "Language is largely error-free." : null,
    bonusSkills.length > 0 ? `Brings bonus skills beyond the JD: ${bonusSkills.slice(0, 3).join(", ")}.` : null,
    sc.impact_score.score >= 75 ? "Bullets show quantified impact." : null,
  ].filter((s): s is string => s !== null);

  const improvements = [
    missing.length > 0 ? `Add missing must-have skills where truthful: ${missing.slice(0, 3).join(", ")}.` : null,
    critical.length > 0 ? `Fix ${critical.length} critical writing error(s) first.` : null,
    sc.impact_score.score < 75 ? "Quantify achievement bullets with numbers." : null,
    sc.formatting_score.score < 82 ? "Resolve the formatting inconsistencies in the Formatting tab." : null,
    sc.keyword_density_score.score < 70 ? "Increase JD keyword coverage in experience bullets." : null,
  ].filter((s): s is string => s !== null);

  const pad = (arr: string[], filler: string[]): string[] =>
    [...arr, ...filler.filter((f) => !arr.includes(f))].slice(0, 3);

  return {
    verdict: out.verdict,
    headline: VERDICT_HEADLINE[out.verdict],
    top_strengths: pad(strengths, [
      "Resume parsed cleanly for ATS extraction.",
      "Standard section structure is present.",
      "Contact information is detectable.",
    ]),
    top_improvements: pad(improvements, [
      "Mirror the JD's exact skill wording where truthful.",
      "Lead every bullet with a strong action verb.",
      "Keep bullet style consistent across sections.",
    ]),
    tailoring_advice:
      missing.length > 0
        ? `Prioritize adding ${missing.slice(0, 2).join(" and ")} to your experience bullets for this role.`
        : "Mirror the job description's phrasing for your strongest matching skills.",
  };
}
