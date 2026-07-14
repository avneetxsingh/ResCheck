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

  it("overall is the weighted formula, verdict from brackets", () => {
    const out = computeScores({ errors: [], formattingAudit: CLEAN_AUDIT, mustHave: [], niceToHave: [] });
    // skills 100*.35 + kw 50*.20 + impact 90*.20 + grammar 95*.15 + formatting 95*.10 = 86.75 → 87
    expect(out.scorecard.overall_ats_score.score).toBe(87);
    expect(out.verdict).toBe("strong");
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
