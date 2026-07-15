import { describe, it, expect } from "vitest";
import { computeScores, buildFallbackSummary } from "@/lib/scoring";
import type { FormattingAudit, Skill, LineError } from "@/types/analysis";

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

describe("computeScores", () => {
  it("perfect input scores 95/95/90 on formatting/grammar/impact and verdict strong", () => {
    const out = computeScores({
      errors: [], formattingAudit: CLEAN_AUDIT,
      mustHave: [skill("React", "exact")], niceToHave: [],
    });
    expect(out.scorecard.formatting_score.score).toBe(95);
    expect(out.scorecard.grammar_score.score).toBe(95);
    expect(out.scorecard.impact_score.score).toBe(90);
    expect(out.scorecard.skills_match_score.score).toBe(100);
    expect(out.scorecard.keyword_density_score.score).toBe(100);
    expect(out.verdict).toBe("strong");
    expect(out.overallMatchPercentage).toBe(100);
  });

  it("weights must-have 80/20 over nice-to-have with partial = 0.5", () => {
    const out = computeScores({
      errors: [], formattingAudit: CLEAN_AUDIT,
      mustHave: [skill("A", "exact"), skill("B", "missing")],
      niceToHave: [skill("C", "partial")],
    });
    // must ratio 0.5, nice ratio 0.5 → (0.5*0.8 + 0.5*0.2)*100 = 50
    expect(out.scorecard.skills_match_score.score).toBe(50);
  });

  it("keyword density is present/total; empty skills default to 50", () => {
    const out = computeScores({ errors: [], formattingAudit: CLEAN_AUDIT, mustHave: [], niceToHave: [] });
    expect(out.scorecard.keyword_density_score.score).toBe(50);
  });

  it("grammar bracket: 4 grammar errors → 67", () => {
    const out = computeScores({
      errors: [err("grammar"), err("spelling"), err("punctuation"), err("tense_inconsistency")],
      formattingAudit: CLEAN_AUDIT, mustHave: [], niceToHave: [],
    });
    expect(out.scorecard.grammar_score.score).toBe(67);
  });

  it("overall is the ATS-screen weighted formula, verdict from brackets", () => {
    const out = computeScores({ errors: [], formattingAudit: CLEAN_AUDIT, mustHave: [], niceToHave: [] });
    // skills 100*.45 + kw 50*.25 + formatting 95*.15 + impact 90*.10 + grammar 95*.05 = 85.5 → 86
    expect(out.scorecard.overall_ats_score.score).toBe(86);
    expect(out.verdict).toBe("strong");
  });

  it("any missing must-have caps overall at 79 (cannot be strong)", () => {
    const out = computeScores({
      errors: [], formattingAudit: CLEAN_AUDIT,
      mustHave: [...Array.from({ length: 9 }, (_, i) => skill(`S${i}`, "exact")), skill("Rust", "missing")],
      niceToHave: [],
    });
    // raw would be 92 — knocked down to the cap
    expect(out.scorecard.overall_ats_score.score).toBe(79);
    expect(out.verdict).toBe("moderate");
    expect(out.scorecard.overall_ats_score.rationale).toContain("Capped");
  });

  it("more than half the must-haves missing caps overall at 49 (critical)", () => {
    const out = computeScores({
      errors: [], formattingAudit: CLEAN_AUDIT,
      mustHave: [skill("A", "exact"), skill("B", "exact"), skill("C", "missing"), skill("D", "missing"), skill("E", "missing")],
      niceToHave: [],
    });
    expect(out.scorecard.overall_ats_score.score).toBe(49);
    expect(out.verdict).toBe("critical");
  });

  it("parse warnings penalize the formatting score by 15 each", () => {
    const out = computeScores({
      errors: [], formattingAudit: CLEAN_AUDIT, mustHave: [], niceToHave: [],
      parseWarningCount: 2,
    });
    expect(out.scorecard.formatting_score.score).toBe(65);
    expect(out.scorecard.formatting_score.rationale).toContain("parse warning");
  });

  it("every metric carries a non-empty rationale and improvement_tip", () => {
    const out = computeScores({
      errors: [err("weak_verb")], formattingAudit: CLEAN_AUDIT,
      mustHave: [skill("A", "missing")], niceToHave: [],
    });
    for (const m of Object.values(out.scorecard)) {
      expect(m.rationale.length).toBeGreaterThan(0);
      expect(m.improvement_tip.length).toBeGreaterThan(0);
    }
  });
});

describe("buildFallbackSummary", () => {
  it("produces exactly 3 strengths and 3 improvements and a headline", () => {
    const out = computeScores({
      errors: [], formattingAudit: CLEAN_AUDIT,
      mustHave: [skill("React", "missing")], niceToHave: [],
    });
    const s = buildFallbackSummary(out, [skill("React", "missing")], [], ["Docker"]);
    expect(s.top_strengths).toHaveLength(3);
    expect(s.top_improvements).toHaveLength(3);
    expect(s.headline.length).toBeGreaterThan(0);
    expect(s.verdict).toBe(out.verdict);
  });
});
