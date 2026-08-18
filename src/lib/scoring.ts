// Server-side deterministic scoring — the ground truth for every score the
// user sees. Per-metric brackets are ported verbatim from pipeline v1. The
// overall weights and must-have knockout caps were re-set 2026-07-15 to mirror
// a real ATS screen (requirement coverage dominates; writing style barely
// registers). Changing weights/caps/brackets is a product decision, not a
// refactor.
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
  // Warnings from ats-extract (no headings, no email/phone, garbled text).
  // Parseability is the first thing a real ATS scores, so these penalize
  // the formatting metric.
  parseWarningCount?: number;
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

const STRENGTH_WEIGHT: Record<NonNullable<Skill["strength"]>, number> = {
  strong: 1.0,
  moderate: 0.6,
  weak: 0.3,
  missing: 0,
};

function strengthRatio(skills: Skill[]): number {
  if (skills.length === 0) return 1.0;
  return (
    skills.reduce((sum, s) => {
      // History entries written before evidence scoring carry only
      // match_strength, so fall back rather than scoring them as zero.
      if (s.strength) return sum + STRENGTH_WEIGHT[s.strength];
      return sum + (s.match_strength === "exact" ? 1 : s.match_strength === "partial" ? 0.5 : 0);
    }, 0) / skills.length
  );
}

export function computeScores(input: ScoringInput): ScoringOutput {
  const { errors, formattingAudit, mustHave, niceToHave } = input;
  const parseWarnings = input.parseWarningCount ?? 0;

  // formatting — audit issue count brackets (v1 verbatim), then parse warnings
  // (missing sections/contact) subtract 15 each: an ATS that can't segment the
  // resume never gets to the cosmetics.
  const auditCount = AUDIT_KEYS.reduce((n, k) => n + formattingAudit[k].length, 0);
  const auditBracket =
    auditCount === 0 ? 95 : auditCount <= 2 ? 82 : auditCount <= 5 ? 67 : auditCount <= 10 ? 50 : 35;
  const formattingScore = Math.max(15, auditBracket - parseWarnings * 15);

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

  // ATS-screen weighting: requirement coverage 70%, parseability 15%, writing
  // style 15% combined — no real screen reads prose quality.
  const rawOverall = Math.round(
    skillsScore * 0.45 + keywordScore * 0.25 + formattingScore * 0.15 + impactScore * 0.1 + grammarScore * 0.05
  );

  const missingMust = mustHave.filter((s) => s.match_strength === "missing").map((s) => s.name);

  // Knockout caps: screens reject on missing must-haves regardless of polish.
  // Any missing → can't be "strong"; more than half missing → "critical".
  const cap =
    mustHave.length === 0 ? 100
    : missingMust.length > mustHave.length / 2 ? 49
    : missingMust.length > 0 ? 79
    : 100;
  const overall = Math.min(rawOverall, cap);

  const verdict: ExecutiveSummary["verdict"] =
    overall >= 80 ? "strong" : overall >= 65 ? "moderate" : overall >= 50 ? "needs_work" : "critical";
  const exactCount = mustHave.filter((s) => s.match_strength === "exact").length;
  const partialCount = mustHave.filter((s) => s.match_strength === "partial").length;

  const scorecard: Scorecard = {
    overall_ats_score: metric(
      overall,
      "Overall",
      overall < rawOverall
        ? `Capped at ${overall}: an ATS screen knocks out on missing must-have skills, no matter how polished the rest is.`
        : "Weighted like a real screen: skills 45%, keywords 25%, parseability 15% — writing style is only the last 15%.",
      missingMust.length > 0
        ? `Biggest lever: the posting asks for ${missingMust.slice(0, 3).join(", ")} and your resume doesn't mention ${missingMust.length === 1 ? "it" : "them"}.`
        : "The gaps left are small — put numbers on your strongest bullets and the score follows."
    ),
    skills_match_score: metric(
      skillsScore,
      "Skills match",
      `Of ${mustHave.length} required skills, ${exactCount} matched exactly and ${partialCount} partially.`,
      missingMust.length > 0
        ? `If you've actually used ${missingMust.slice(0, 3).join(", ")}, say so — right now the resume doesn't.`
        : "Every requirement is covered. Use the posting's exact wording so the match is unmissable."
    ),
    grammar_score: metric(
      grammarScore,
      "Grammar & language",
      grammarCount === 0
        ? "No grammar, spelling, punctuation, or tense problems found."
        : `${grammarCount} language ${grammarCount === 1 ? "problem" : "problems"} — grammar, spelling, punctuation, or tense.`,
      grammarCount > 0
        ? "These are the cheapest points on the page — each one has a ready rewrite in the Errors tab."
        : "Clean. Re-check after any edits; typos creep in late."
    ),
    formatting_score: metric(
      formattingScore,
      "Formatting",
      parseWarnings > 0
        ? `${parseWarnings} parse ${parseWarnings === 1 ? "warning" : "warnings"} (see "What the ATS sees")${auditCount > 0 ? ` plus ${auditCount} formatting ${auditCount === 1 ? "inconsistency" : "inconsistencies"}` : ""}.`
        : auditCount === 0
        ? "Parses cleanly, and spacing, bullets, dates, and casing are consistent throughout."
        : `${auditCount} ${auditCount === 1 ? "inconsistency" : "inconsistencies"} in spacing, bullets, dates, or casing.`,
      parseWarnings > 0
        ? "Fix the parse warnings first — an ATS that can't read the resume never sees the content."
        : auditCount > 0
        ? "The Formatting tab quotes each one verbatim — fixes take a minute apiece."
        : "Nothing to do here."
    ),
    impact_score: metric(
      impactScore,
      "Impact",
      impactCount === 0
        ? "Bullets lead with strong verbs and carry numbers."
        : `${impactCount} ${impactCount === 1 ? "bullet reads" : "bullets read"} flat — weak verbs, passive voice, or claims with no numbers.`,
      impactCount > 0
        ? "Rewrite the flagged ones: verb first, then the number — %, $, headcount, time saved."
        : "Keep this up — quantified bullets are what get read."
    ),
    keyword_density_score: metric(
      keywordScore,
      "Keyword coverage",
      `${presentCount} of the ${allSkills.length} skills in the posting appear somewhere in your resume.`,
      presentCount < allSkills.length
        ? "Fold the missing terms into real experience bullets. Don't stuff a keywords section."
        : "Full coverage — every term the posting uses shows up at least once."
    ),
  };

  return { scorecard, verdict, overallMatchPercentage: skillsScore };
}

const VERDICT_HEADLINE: Record<ExecutiveSummary["verdict"], string> = {
  strong: "Good fit — this should clear an ATS screen for the role.",
  moderate: "Close, but a handful of fixable gaps are worth closing before you apply.",
  needs_work: "Not there yet — a few targeted fixes would change how this screens.",
  critical: "As written, this is unlikely to get past screening for this role.",
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
    exact.length > 0 ? `${exact.slice(0, 3).join(", ")} — required, and clearly there.` : null,
    sc.formatting_score.score >= 82 ? "Formatting is consistent, so nothing distracts from the content." : null,
    sc.grammar_score.score >= 82 ? "The writing is clean — little to no language errors." : null,
    bonusSkills.length > 0 ? `${bonusSkills.slice(0, 3).join(", ")} go beyond what the posting asks for.` : null,
    sc.impact_score.score >= 75 ? "Bullets carry real numbers, which is what gets read." : null,
  ].filter((s): s is string => s !== null);

  const improvements = [
    missing.length > 0 ? `The posting requires ${missing.slice(0, 3).join(", ")} and the resume never mentions ${missing.length === 1 ? "it" : "them"}.` : null,
    critical.length > 0 ? `${critical.length} critical writing ${critical.length === 1 ? "error" : "errors"} — fix ${critical.length === 1 ? "that" : "those"} before anything else.` : null,
    sc.impact_score.score < 75 ? "Too many bullets have no numbers behind them." : null,
    sc.formatting_score.score < 82 ? "Formatting inconsistencies add up — the Formatting tab lists each one." : null,
    sc.keyword_density_score.score < 70 ? "A lot of the posting's terms never appear in the resume text." : null,
  ].filter((s): s is string => s !== null);

  const pad = (arr: string[], filler: string[]): string[] =>
    [...arr, ...filler.filter((f) => !arr.includes(f))].slice(0, 3);

  return {
    verdict: out.verdict,
    headline: VERDICT_HEADLINE[out.verdict],
    top_strengths: pad(strengths, [
      "The PDF parses cleanly — an ATS can read it.",
      "Sections follow the structure screeners expect.",
      "Contact details are where a parser looks for them.",
    ]),
    top_improvements: pad(improvements, [
      "Where you match a requirement, use the posting's exact words.",
      "Start every bullet with a verb that did something.",
      "Pick one bullet style and stick to it everywhere.",
    ]),
    tailoring_advice:
      missing.length > 0
        ? `For this role, start with ${missing.slice(0, 2).join(" and ")} — work ${missing.length === 1 ? "it" : "them"} into your experience bullets if you can claim ${missing.length === 1 ? "it" : "them"} honestly.`
        : "You match the requirements — now echo the posting's own phrasing so the screen can't miss it.",
  };
}
