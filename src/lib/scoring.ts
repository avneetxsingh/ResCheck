// Writing-quality scoring. These three metrics measure something real about the
// document and nothing more — they are NOT a screening outcome. The screening
// outcome is the funnel in ./funnel.ts. Per-metric brackets are ported verbatim
// from pipeline v1; changing a bracket is a product decision, not a refactor.
import type {
  ExecutiveSummary, FormattingAudit, FunnelResult, LineError, Scorecard, ScorecardMetric, Skill,
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
  // Warnings from ats-extract (no headings, no email/phone, garbled text).
  // Gate 1 owns the screening consequence; here they only cost formatting points.
  parseWarningCount?: number;
}

export interface ScoringOutput {
  scorecard: Scorecard;
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

export function computeScores(input: ScoringInput): ScoringOutput {
  const { errors, formattingAudit } = input;
  const parseWarnings = input.parseWarningCount ?? 0;

  const auditCount = AUDIT_KEYS.reduce((n, k) => n + formattingAudit[k].length, 0);
  const auditBracket =
    auditCount === 0 ? 95 : auditCount <= 2 ? 82 : auditCount <= 5 ? 67 : auditCount <= 10 ? 50 : 35;
  const formattingScore = Math.max(15, auditBracket - parseWarnings * 15);

  const grammarCount = errors.filter((e) => GRAMMAR_TYPES.has(e.error_type)).length;
  const grammarScore = grammarCount === 0 ? 95 : grammarCount <= 3 ? 82 : grammarCount <= 7 ? 67 : 45;

  const impactCount = errors.filter((e) => IMPACT_TYPES.has(e.error_type)).length;
  const impactScore =
    impactCount === 0 ? 90 : impactCount <= 2 ? 75 : impactCount <= 5 ? 60 : impactCount <= 9 ? 45 : 30;

  const scorecard: Scorecard = {
    grammar_score: metric(
      grammarScore,
      "Grammar & language",
      grammarCount === 0
        ? "No grammar, spelling, punctuation, or tense problems found."
        : `${grammarCount} language ${grammarCount === 1 ? "problem" : "problems"} — grammar, spelling, punctuation, or tense.`,
      grammarCount > 0
        ? "These are the cheapest fixes on the page — each one has a ready rewrite in the Errors tab."
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
        ? "Fix the parse warnings first — they are what the Parse gate is reporting."
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
  };

  return { scorecard };
}

const VERDICT_HEADLINE: Record<ExecutiveSummary["verdict"], string> = {
  strong: "You clear all three screening gates for this posting.",
  moderate: "You clear the gates that can be checked, with a few things worth closing first.",
  needs_work: "Something in the funnel is blocking this — worth fixing before you apply.",
  critical: "A stated requirement isn't met, which is the one thing that stops an application outright.",
};

export interface FallbackInput {
  scorecard: Scorecard;
  verdict: ExecutiveSummary["verdict"];
  funnel: FunnelResult;
  mustHave: Skill[];
  errors: Omit<LineError, "id">[];
  bonusSkills: string[];
}

// Used when the summary AI stage fails. Every input is deterministic, so the
// fallback is factual rather than generic — and it narrates the funnel, because
// there is no longer an overall score to narrate.
export function buildFallbackSummary(input: FallbackInput): ExecutiveSummary {
  const { scorecard: sc, verdict, funnel, mustHave, errors, bonusSkills } = input;
  const failed = funnel.knockout.checks.filter((c) => c.required && c.verdict === "fail");
  const unverifiable = funnel.knockout.checks.filter((c) => c.required && c.verdict === "unverifiable");
  // Only work_authorization/location are the "form will ask" case — a degree
  // or years check that came back unverifiable (e.g. no education section
  // parsed) needs its own sentence, not this one folded around it.
  const formAsks = unverifiable.filter((c) => c.type === "work_authorization" || c.type === "location");
  const otherUnverifiable = unverifiable.filter((c) => c.type !== "work_authorization" && c.type !== "location");
  const exact = mustHave.filter((s) => s.match_strength === "exact").map((s) => s.name);
  const critical = errors.filter((e) => e.severity === "critical");
  const bonusNamed = bonusSkills.slice(0, 3);

  const strengths = [
    funnel.parse.verdict === "clean" ? "The document parses cleanly — an ATS can read every section." : null,
    funnel.retrieve.total > 0 && funnel.retrieve.misses.length === 0
      ? `Your resume surfaces for all ${funnel.retrieve.total} recruiter searches built from this posting.`
      : null,
    exact.length > 0 ? `${exact.slice(0, 3).join(", ")} — required, and clearly there.` : null,
    bonusNamed.length > 0
      ? `${bonusNamed.join(", ")} ${bonusNamed.length === 1 ? "goes" : "go"} beyond what the posting asks for.`
      : null,
    sc.impact_score.score >= 75 ? "Bullets carry real numbers, which is what gets read." : null,
    sc.grammar_score.score >= 82 ? "The writing is clean — little to no language errors." : null,
  ].filter((s): s is string => s !== null);

  const improvements = [
    failed.length > 0 ? failed.map((c) => c.detail).join(" ") : null,
    funnel.parse.verdict === "likely_breaks"
      ? `The document may not survive parsing: ${funnel.parse.reasons.slice(0, 2).join(" ")}`
      : null,
    funnel.retrieve.misses.length > 0
      ? `Your resume doesn't surface for ${funnel.retrieve.misses.slice(0, 3).join(", ")}.`
      : null,
    formAsks.length > 0
      ? `The application form will ask about ${formAsks.map((c) => c.value).join(", ")} — ResCheck can't see that, so check it yourself.`
      : null,
    otherUnverifiable.length > 0 ? otherUnverifiable.map((c) => c.detail).join(" ") : null,
    critical.length > 0
      ? `${critical.length} critical writing ${critical.length === 1 ? "error" : "errors"} — fix ${critical.length === 1 ? "that" : "those"} before anything else.`
      : null,
    sc.impact_score.score < 75 ? "Too many bullets have no numbers behind them." : null,
  ].filter((s): s is string => s !== null);

  const pad = (arr: string[], filler: string[]): string[] =>
    [...arr, ...filler.filter((f) => !arr.includes(f))].slice(0, 3);

  // Fillers pad the list when real strengths run short. They must be true
  // regardless of what else is on the page, so each is conditional on the
  // exact gate it describes actually being clean — the previous static
  // fillers claimed a clean parse and a vocabulary match unconditionally,
  // which could sit next to a Gate 1 "likely_breaks" or a Gate 3 all-miss in
  // the same view.
  const strengthFillers = [
    funnel.parse.verdict === "clean" ? "Sections follow the structure screeners expect." : null,
    funnel.parse.verdict === "clean" ? "Contact details are where a parser looks for them." : null,
    funnel.retrieve.total > 0 && funnel.retrieve.misses.length === 0
      ? "The posting's own vocabulary shows up in the resume text."
      : null,
  ].filter((s): s is string => s !== null);

  return {
    verdict,
    headline: VERDICT_HEADLINE[verdict],
    top_strengths: pad(strengths, strengthFillers),
    top_improvements: pad(improvements, [
      "Where you match a requirement, use the posting's exact words.",
      "Start every bullet with a verb that did something.",
      "Pick one bullet style and stick to it everywhere.",
    ]),
    tailoring_advice:
      failed.length > 0
        ? `Start with the stated requirement you don't meet: ${failed[0].detail}`
        : funnel.retrieve.misses.length > 0
          ? `Work ${funnel.retrieve.misses[0]} into a real experience bullet if you can claim it honestly — right now no search for it finds you.`
          : "You clear what can be checked — echo the posting's own phrasing so the match is unmissable.",
  };
}
