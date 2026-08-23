import { describe, it, expect } from "vitest";
import { computeScores, buildFallbackSummary } from "@/lib/scoring";
import type { FormattingAudit, Skill, LineError, FunnelResult } from "@/types/analysis";

const CLEAN_AUDIT: FormattingAudit = {
  whitespace_issues: [], bold_inconsistencies: [], bullet_inconsistencies: [],
  date_format_issues: [], capitalization_issues: [], other_inconsistencies: [],
  is_clean: true,
};

const skill = (name: string, strength: Skill["match_strength"]): Skill => ({
  name, present_in_resume: strength !== "missing", category: "technical", match_strength: strength,
});

const err = (error_type: LineError["error_type"]): Omit<LineError, "id"> => ({
  original_line: "x y z a b", fixed_line: "better", error_type,
  reason: "r", section: "experience", severity: "moderate",
});

const PASSING_FUNNEL: FunnelResult = {
  parse: { verdict: "clean", reasons: [] },
  knockout: { verdict: "pass", stated: true, checks: [] },
  retrieve: { queries: [], surfaced: 3, total: 3, misses: [] },
  signals: [],
};

describe("computeScores", () => {
  it("keeps only the three writing metrics", () => {
    const out = computeScores({ errors: [], formattingAudit: CLEAN_AUDIT });
    expect(out.scorecard.formatting_score.score).toBe(95);
    expect(out.scorecard.grammar_score.score).toBe(95);
    expect(out.scorecard.impact_score.score).toBe(90);
    expect(out.scorecard.overall_ats_score).toBeUndefined();
    expect(out.scorecard.skills_match_score).toBeUndefined();
    expect(out.scorecard.keyword_density_score).toBeUndefined();
  });

  it("grammar bracket: 4 grammar errors → 67", () => {
    const out = computeScores({
      errors: [err("grammar"), err("spelling"), err("punctuation"), err("tense_inconsistency")],
      formattingAudit: CLEAN_AUDIT,
    });
    expect(out.scorecard.grammar_score.score).toBe(67);
  });

  it("impact bracket: 3 impact errors → 60", () => {
    const out = computeScores({
      errors: [err("weak_verb"), err("passive_voice"), err("vague_language")],
      formattingAudit: CLEAN_AUDIT,
    });
    expect(out.scorecard.impact_score.score).toBe(60);
  });

  it("parse warnings subtract 15 each from formatting, with a floor of 15", () => {
    const out = computeScores({ errors: [], formattingAudit: CLEAN_AUDIT, parseWarningCount: 2 });
    expect(out.scorecard.formatting_score.score).toBe(65);
    const floored = computeScores({ errors: [], formattingAudit: CLEAN_AUDIT, parseWarningCount: 20 });
    expect(floored.scorecard.formatting_score.score).toBe(15);
  });
});

describe("buildFallbackSummary — writing audit did not run", () => {
  // An empty error list means "not measured" here, not "nothing wrong". The
  // summary used to read the writing scores anyway and claim a clean resume.
  const unaudited = () =>
    buildFallbackSummary({
      scorecard: computeScores({ errors: [], formattingAudit: CLEAN_AUDIT }).scorecard,
      verdict: "moderate",
      funnel: PASSING_FUNNEL,
      mustHave: [],
      errors: [],
      bonusSkills: [],
      writingAuditRan: false,
    });

  it("never claims the writing is clean", () => {
    const summary = unaudited();
    const all = [...summary.top_strengths, ...summary.top_improvements].join(" ");
    expect(all).not.toContain("The writing is clean");
    expect(all).not.toContain("Bullets carry real numbers");
  });

  it("says the audit did not run", () => {
    expect(unaudited().top_improvements.join(" ")).toContain("writing audit didn't run");
  });

  it("does not announce a missing audit when the audit did run", () => {
    const audited = buildFallbackSummary({
      scorecard: computeScores({ errors: [], formattingAudit: CLEAN_AUDIT }).scorecard,
      verdict: "moderate",
      funnel: PASSING_FUNNEL,
      mustHave: [],
      errors: [],
      bonusSkills: [],
      writingAuditRan: true,
    });
    const all = [...audited.top_strengths, ...audited.top_improvements].join(" ");
    expect(all).not.toContain("writing audit didn't run");
  });
});

describe("buildFallbackSummary", () => {
  it("narrates the funnel, not a score", () => {
    const out = computeScores({ errors: [], formattingAudit: CLEAN_AUDIT });
    const summary = buildFallbackSummary({
      scorecard: out.scorecard,
      verdict: "critical",
      funnel: {
        ...PASSING_FUNNEL,
        knockout: {
          verdict: "fail", stated: true,
          checks: [{
            type: "years_experience", value: "5", required: true,
            verdict: "fail", detail: "3 years of dated experience against 5 years required.",
          }],
        },
      },
      mustHave: [skill("React", "exact")],
      errors: [],
      bonusSkills: [],
    });
    expect(summary.verdict).toBe("critical");
    expect(summary.top_improvements.join(" ")).toContain("5 years required");
    expect(summary.top_strengths).toHaveLength(3);
    expect(summary.top_improvements).toHaveLength(3);
  });

  it("names the missed searches when retrieval is the blocker", () => {
    const out = computeScores({ errors: [], formattingAudit: CLEAN_AUDIT });
    const summary = buildFallbackSummary({
      scorecard: out.scorecard,
      verdict: "needs_work",
      funnel: {
        ...PASSING_FUNNEL,
        retrieve: { queries: [], surfaced: 1, total: 3, misses: ["Terraform", "React AND Terraform"] },
      },
      mustHave: [skill("Terraform", "missing")],
      errors: [],
      bonusSkills: [],
    });
    expect(summary.top_improvements.join(" ")).toContain("Terraform");
  });

  it("never claims work authorization or location was cleared", () => {
    const out = computeScores({ errors: [], formattingAudit: CLEAN_AUDIT });
    const summary = buildFallbackSummary({
      scorecard: out.scorecard,
      verdict: "moderate",
      funnel: {
        ...PASSING_FUNNEL,
        knockout: {
          verdict: "unverifiable", stated: true,
          checks: [{
            type: "work_authorization", value: "US work authorization", required: true,
            verdict: "unverifiable", detail: "The form will ask this.",
          }],
        },
      },
      mustHave: [],
      errors: [],
      bonusSkills: [],
    });
    const all = [summary.headline, ...summary.top_strengths, ...summary.top_improvements].join(" ");
    expect(all).not.toMatch(/work authorization[^.]*\b(pass|passed|clear|cleared|meet|met)\b/i);
  });
});
