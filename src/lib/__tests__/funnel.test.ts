import { describe, it, expect } from "vitest";
import { evaluateParseGate, evaluateKnockoutGate, normalizeRequirementType, buildRetrievalQueries, evaluateRetrieveGate } from "@/lib/funnel";
import type { FormattingAudit } from "@/types/analysis";
import type { JdRequirement } from "@/types/analysis";
import type { StructuredResume } from "@/lib/ats-extract";

const CLEAN_AUDIT: FormattingAudit = {
  whitespace_issues: [], bold_inconsistencies: [], bullet_inconsistencies: [],
  date_format_issues: [], capitalization_issues: [], other_inconsistencies: [],
  is_clean: true,
};

const auditWith = (n: number): FormattingAudit => ({
  ...CLEAN_AUDIT,
  whitespace_issues: Array.from({ length: n }, (_, i) => `[Experience] > double space: 'a  b${i}'`),
  is_clean: n === 0,
});

const structured = (over: Partial<StructuredResume> = {}): StructuredResume => ({
  sections: [
    { name: "contact", heading: "", lines: ["Jane Doe", "jane@example.com | 555-123-4567"] },
    { name: "experience", heading: "Experience", lines: ["Senior Engineer, Acme"] },
  ],
  contact: { email: "jane@example.com", phone: "555-123-4567", links: [] },
  warnings: [],
  ...over,
});

describe("evaluateParseGate", () => {
  it("clean input with no warnings is clean", () => {
    expect(evaluateParseGate(structured(), CLEAN_AUDIT).verdict).toBe("clean");
  });

  it("no section headings is likely_breaks", () => {
    const s = structured({
      sections: [{ name: "contact", heading: "", lines: ["Jane Doe", "jane@example.com"] }],
      warnings: ["No standard section headings detected — an ATS may fail to segment this resume."],
    });
    expect(evaluateParseGate(s, CLEAN_AUDIT).verdict).toBe("likely_breaks");
  });

  it("no email AND no phone is likely_breaks", () => {
    const s = structured({
      contact: { email: null, phone: null, links: [] },
      warnings: ["No email address found — ATS contact parsing will fail.", "No phone number found."],
    });
    expect(evaluateParseGate(s, CLEAN_AUDIT).verdict).toBe("likely_breaks");
  });

  it("a missing phone alone is only risky, not likely_breaks", () => {
    const s = structured({
      contact: { email: "jane@example.com", phone: null, links: [] },
      warnings: ["No phone number found."],
    });
    expect(evaluateParseGate(s, CLEAN_AUDIT).verdict).toBe("risky");
  });

  it("four or more formatting issues is risky even with no parse warnings", () => {
    expect(evaluateParseGate(structured(), auditWith(4)).verdict).toBe("risky");
    expect(evaluateParseGate(structured(), auditWith(3)).verdict).toBe("clean");
  });

  it("carries the parse warnings through verbatim as reasons", () => {
    const s = structured({ warnings: ["No phone number found."] });
    expect(evaluateParseGate(s, CLEAN_AUDIT).reasons).toContain("No phone number found.");
  });
});

const withEducation = (lines: string[]): StructuredResume =>
  structured({
    sections: [
      { name: "contact", heading: "", lines: ["Jane Doe", "jane@example.com"] },
      { name: "experience", heading: "Experience", lines: ["Senior Engineer, Acme"] },
      { name: "education", heading: "Education", lines },
    ],
  });

const req = (
  type: JdRequirement["type"],
  value: string,
  required = true
): JdRequirement => ({ type, value, required });

const CTX = {
  structured: withEducation(["B.S. Computer Science, State University"]),
  resumeText: "Jane Doe\nSenior Engineer at Acme\nB.S. Computer Science, State University",
  totalExperienceMonths: 72,
  hasDatedRoles: true,
};

describe("normalizeRequirementType", () => {
  it("accepts the canonical names", () => {
    expect(normalizeRequirementType("years_experience")).toBe("years_experience");
  });

  it("normalizes spacing and casing the way the model actually writes it", () => {
    expect(normalizeRequirementType("Years Experience")).toBe("years_experience");
    expect(normalizeRequirementType("work-authorization")).toBe("work_authorization");
  });

  it("maps the near-synonyms the model reaches for", () => {
    expect(normalizeRequirementType("education")).toBe("degree");
    expect(normalizeRequirementType("visa")).toBe("work_authorization");
    expect(normalizeRequirementType("certifications")).toBe("certification");
  });

  it("returns null for anything unrecognized, so the caller can drop it", () => {
    expect(normalizeRequirementType("salary")).toBeNull();
  });
});

describe("evaluateKnockoutGate — degree", () => {
  it("a Master's satisfies a Bachelor's requirement", () => {
    const ctx = { ...CTX, structured: withEducation(["M.S. Computer Science, State University"]) };
    const gate = evaluateKnockoutGate([req("degree", "Bachelor's degree")], ctx);
    expect(gate.checks[0].verdict).toBe("pass");
    expect(gate.verdict).toBe("pass");
  });

  it("a Bachelor's fails a Master's requirement", () => {
    const gate = evaluateKnockoutGate([req("degree", "Master's degree")], CTX);
    expect(gate.checks[0].verdict).toBe("fail");
    expect(gate.verdict).toBe("fail");
  });

  it("no education section at all is unverifiable, never a fail", () => {
    const ctx = { ...CTX, structured: structured() };
    const gate = evaluateKnockoutGate([req("degree", "Bachelor's degree")], ctx);
    expect(gate.checks[0].verdict).toBe("unverifiable");
    expect(gate.verdict).toBe("unverifiable");
  });

  it("an education section holding no recognizable degree fails", () => {
    const ctx = { ...CTX, structured: withEducation(["State University, coursework in CS"]) };
    expect(evaluateKnockoutGate([req("degree", "Bachelor's degree")], ctx).checks[0].verdict).toBe("fail");
  });

  it("a degree requirement that names no level is unverifiable", () => {
    const gate = evaluateKnockoutGate([req("degree", "an engineering qualification")], CTX);
    expect(gate.checks[0].verdict).toBe("unverifiable");
  });

  it("a bare mention of the degree is unverifiable, not a pass", () => {
    const ctx = {
      ...CTX,
      structured: withEducation([
        "B.A. Fine Arts, State University",
        "Coordinated the Master's Program orientation",
      ]),
    };
    const gate = evaluateKnockoutGate([req("degree", "Master's degree")], ctx);
    expect(gate.checks[0].verdict).toBe("unverifiable");
    expect(gate.verdict).toBe("unverifiable");
  });

  it("a credential held outranks a bare mention of a higher one", () => {
    const ctx = {
      ...CTX,
      structured: withEducation([
        "B.A. Fine Arts, State University",
        "Coordinated the Master's Program orientation",
      ]),
    };
    expect(evaluateKnockoutGate([req("degree", "Bachelor's degree")], ctx).checks[0].verdict).toBe("pass");
  });

  it("a credential form still passes on its own", () => {
    const ctx = { ...CTX, structured: withEducation(["M.S. Computer Science, State University"]) };
    expect(evaluateKnockoutGate([req("degree", "Master's degree")], ctx).checks[0].verdict).toBe("pass");
  });
});

describe("evaluateKnockoutGate — years of experience", () => {
  it("36 months fails a 5-year requirement", () => {
    const ctx = { ...CTX, totalExperienceMonths: 36 };
    const gate = evaluateKnockoutGate([req("years_experience", "5")], ctx);
    expect(gate.checks[0].verdict).toBe("fail");
    expect(gate.checks[0].detail).toContain("3 years");
  });

  it("72 months passes a 5-year requirement", () => {
    expect(evaluateKnockoutGate([req("years_experience", "5")], CTX).checks[0].verdict).toBe("pass");
  });

  it("no dated roles is unverifiable, never a fail", () => {
    const ctx = { ...CTX, hasDatedRoles: false, totalExperienceMonths: 0 };
    expect(evaluateKnockoutGate([req("years_experience", "5")], ctx).checks[0].verdict).toBe("unverifiable");
  });

  it("reads the number out of the posting's own phrasing", () => {
    const ctx = { ...CTX, totalExperienceMonths: 24 };
    expect(evaluateKnockoutGate([req("years_experience", "3+ years")], ctx).checks[0].verdict).toBe("fail");
  });

  it("a requirement stating no number is unverifiable", () => {
    expect(evaluateKnockoutGate([req("years_experience", "several years")], CTX).checks[0].verdict).toBe("unverifiable");
  });
});

describe("evaluateKnockoutGate — certification", () => {
  it("passes when the certification appears in the resume", () => {
    const ctx = { ...CTX, resumeText: `${CTX.resumeText}\nAWS Solutions Architect, 2024` };
    expect(evaluateKnockoutGate([req("certification", "AWS Solutions Architect")], ctx).checks[0].verdict).toBe("pass");
  });

  it("fails when it does not", () => {
    expect(evaluateKnockoutGate([req("certification", "AWS Solutions Architect")], CTX).checks[0].verdict).toBe("fail");
  });
});

describe("evaluateKnockoutGate — the honesty guarantee", () => {
  it("work authorization is unverifiable no matter what the resume says", () => {
    const ctx = { ...CTX, resumeText: "US citizen, authorized to work in the US without sponsorship" };
    const gate = evaluateKnockoutGate([req("work_authorization", "US work authorization")], ctx);
    expect(gate.checks[0].verdict).toBe("unverifiable");
    expect(gate.verdict).toBe("unverifiable");
  });

  it("location is unverifiable no matter what the resume says", () => {
    const ctx = { ...CTX, resumeText: "Austin, TX — open to hybrid work" };
    expect(evaluateKnockoutGate([req("location", "Hybrid, Austin TX")], ctx).checks[0].verdict).toBe("unverifiable");
  });
});

describe("evaluateKnockoutGate — gate verdict", () => {
  it("only required items can fail the gate", () => {
    const gate = evaluateKnockoutGate([req("certification", "AWS Solutions Architect", false)], CTX);
    expect(gate.checks[0].verdict).toBe("fail");
    expect(gate.verdict).toBe("pass");
  });

  it("a required fail outranks a required unverifiable", () => {
    const gate = evaluateKnockoutGate(
      [req("location", "Austin TX"), req("degree", "Master's degree")],
      CTX
    );
    expect(gate.verdict).toBe("fail");
  });

  it("reports stated=false when the posting names no required condition", () => {
    const gate = evaluateKnockoutGate([req("certification", "AWS", false)], CTX);
    expect(gate.stated).toBe(false);
    const stated = evaluateKnockoutGate([req("degree", "Bachelor's degree")], CTX);
    expect(stated.stated).toBe(true);
  });

  it("an empty requirements list yields no checks and stated=false", () => {
    const gate = evaluateKnockoutGate([], CTX);
    expect(gate.checks).toEqual([]);
    expect(gate.stated).toBe(false);
  });
});

describe("buildRetrievalQueries", () => {
  it("issues each must-have alone", () => {
    expect(buildRetrievalQueries(["React", "SQL"])).toContainEqual(["React"]);
    expect(buildRetrievalQueries(["React", "SQL"])).toContainEqual(["SQL"]);
  });

  it("adds AND pairs of the top three only, so the set stays bounded", () => {
    // 5 singles + the 3 pairs drawn from the first three skills
    const q = buildRetrievalQueries(["A", "B", "C", "D", "E"]);
    expect(q).toHaveLength(8);
    expect(q.filter((t) => t.length === 2)).toEqual([["A", "B"], ["A", "C"], ["B", "C"]]);
  });

  it("makes no pair from a single skill", () => {
    expect(buildRetrievalQueries(["React"])).toEqual([["React"]]);
  });

  it("drops blank names", () => {
    expect(buildRetrievalQueries(["React", "  "])).toEqual([["React"]]);
  });
});

describe("evaluateRetrieveGate", () => {
  const RESUME = "Built services with React and TypeScript. Deployed on k8s. Wrote SQL by hand.";

  it("a skill present only via alias still surfaces", () => {
    const gate = evaluateRetrieveGate(["Kubernetes"], RESUME);
    expect(gate.queries[0].surfaces).toBe(true);
    expect(gate.misses).toEqual([]);
  });

  it("names the specific queries that miss", () => {
    const gate = evaluateRetrieveGate(["React", "Terraform"], RESUME);
    expect(gate.misses).toContain("Terraform");
    expect(gate.misses).not.toContain("React");
  });

  it("an AND pair requires both terms", () => {
    const gate = evaluateRetrieveGate(["React", "Terraform"], RESUME);
    expect(gate.misses).toContain("React AND Terraform");
  });

  it("counts surfaced against total", () => {
    const gate = evaluateRetrieveGate(["React", "SQL"], RESUME);
    expect(gate.total).toBe(3); // React, SQL, React AND SQL
    expect(gate.surfaced).toBe(3);
  });

  it("no must-have skills yields an empty, non-throwing gate", () => {
    const gate = evaluateRetrieveGate([], RESUME);
    expect(gate).toEqual({ queries: [], surfaced: 0, total: 0, misses: [] });
  });
});
