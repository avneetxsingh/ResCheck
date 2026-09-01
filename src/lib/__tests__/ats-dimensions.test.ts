import { describe, it, expect } from "vitest";
import {
  buildAtsDimensions,
  hasNoMeasurableDimension,
  summariseChecks,
} from "@/lib/ats-dimensions";
import type { AnalysisResult, Skill, KnockoutCheck } from "@/types/analysis";

function skill(name: string, present: boolean): Skill {
  return {
    name,
    present_in_resume: present,
    category: "technical",
    match_strength: present ? "exact" : "missing",
  };
}

function check(verdict: KnockoutCheck["verdict"]): KnockoutCheck {
  return { type: "degree", value: "Bachelor's", required: true, verdict, detail: "" };
}

function makeResult(over: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    scorecard: {} as AnalysisResult["scorecard"],
    skills_gap: { must_have: [], nice_to_have: [], bonus_skills: [] },
    errors: [],
    summary: {} as AnalysisResult["summary"],
    metadata: {
      model: "m",
      analyzed_at: "2026-09-01T00:00:00.000Z",
      resume_word_count: 1,
      jd_word_count: 1,
      total_errors_found: 0,
    },
    ...over,
  };
}

function dim(result: AnalysisResult, key: string) {
  return buildAtsDimensions(result).find((d) => d.key === key)!;
}

describe("buildAtsDimensions", () => {
  it("reports a real ratio with its raw counts", () => {
    const result = makeResult({
      funnel: {
        parse: { verdict: "clean", reasons: [] },
        knockout: { verdict: "pass", stated: true, checks: [] },
        retrieve: { queries: [], surfaced: 7, total: 9, misses: [] },
        signals: [],
      },
    });
    const d = dim(result, "retrieve");
    expect(d.present).toBe(7);
    expect(d.total).toBe(9);
    expect(d.ratio).toBeCloseTo(7 / 9);
    expect(d.detail).toBe("7 of 9 recruiter searches");
  });

  // The whole reason ratio is nullable. A posting that states nothing to check
  // must not plot at the origin next to one that failed everything.
  it("marks an unmeasurable dimension null rather than zero", () => {
    const d = dim(makeResult(), "must_have");
    expect(d.ratio).toBeNull();
    expect(d.present).toBeNull();
    expect(d.total).toBeNull();
    expect(d.detail).toBe("None stated");
  });

  it("distinguishes zero-of-many from not-measurable", () => {
    const result = makeResult({
      skills_gap: {
        must_have: [skill("Go", false), skill("Rust", false)],
        nice_to_have: [],
        bonus_skills: [],
      },
    });
    const d = dim(result, "must_have");
    expect(d.ratio).toBe(0);
    expect(d.total).toBe(2);
    expect(d.detail).toBe("0 of 2 required skills");
  });

  // work_authorization and location are always unverifiable. Counting them
  // either way would invent a verdict the app refuses to give.
  it("counts only checkable requirements", () => {
    const result = makeResult({
      funnel: {
        parse: { verdict: "clean", reasons: [] },
        knockout: {
          verdict: "pass",
          stated: true,
          checks: [check("pass"), check("fail"), check("unverifiable")],
        },
        retrieve: { queries: [], surfaced: 0, total: 0, misses: [] },
        signals: [],
      },
    });
    const d = dim(result, "requirements");
    expect(d.total).toBe(2);
    expect(d.present).toBe(1);
  });

  it("uses the singular noun for a total of one", () => {
    const result = makeResult({
      skills_gap: { must_have: [skill("Go", true)], nice_to_have: [], bonus_skills: [] },
    });
    expect(dim(result, "must_have").detail).toBe("1 of 1 required skill");
  });

  it("derives sections from detected plus missing", () => {
    const result = makeResult({
      ats_extraction: {
        sections_detected: ["experience", "skills", "education"],
        contact: { email: null, phone: null, links: [] },
        warnings: [],
        sections_missing: ["summary"],
      },
    });
    const d = dim(result, "sections");
    expect(d.total).toBe(4);
    expect(d.present).toBe(3);
  });

  it("gives five axes and never an overall figure", () => {
    const dims = buildAtsDimensions(makeResult());
    expect(dims).toHaveLength(5);
    expect(dims.some((d) => /overall|score|match/i.test(d.label))).toBe(false);
  });

  // A pre-funnel history entry must render, not crash (invariant 8).
  it("survives an entry with no funnel, skills or extraction", () => {
    const dims = buildAtsDimensions(makeResult());
    expect(hasNoMeasurableDimension(dims)).toBe(true);
  });
});

describe("summariseChecks", () => {
  const dims = [
    { key: "a", label: "Searches", present: 9, total: 9, ratio: 1, detail: "" },
    { key: "b", label: "Must-haves", present: 4, total: 6, ratio: 4 / 6, detail: "" },
    { key: "c", label: "Nice-to-haves", present: null, total: null, ratio: null, detail: "" },
  ];

  it("sums the discrete checks that were actually run", () => {
    const t = summariseChecks(dims);
    expect(t.passed).toBe(13);
    expect(t.total).toBe(15);
  });

  // An axis nobody could check must not count as a failure — that is the
  // difference between this and the score sub-project C deleted.
  it("excludes an unmeasurable axis from both sides and names it", () => {
    const t = summariseChecks(dims);
    expect(t.unmeasured).toEqual(["Nice-to-haves"]);
    expect(t.total).toBe(15);
  });

  it("reports nothing measurable as a zero total rather than a zero score", () => {
    const t = summariseChecks([
      { key: "a", label: "Searches", present: null, total: null, ratio: null, detail: "" },
    ]);
    expect(t.total).toBe(0);
    expect(t.passed).toBe(0);
    expect(t.unmeasured).toEqual(["Searches"]);
  });
});
