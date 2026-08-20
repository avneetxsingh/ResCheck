import { describe, it, expect } from "vitest";
import { evaluateParseGate, evaluateKnockoutGate, normalizeRequirementType, buildRetrievalQueries, evaluateRetrieveGate, buildSignals, deriveFunnelVerdict, buildFunnel, firstRequiredYears } from "@/lib/funnel";
import type { FormattingAudit } from "@/types/analysis";
import type { JdRequirement } from "@/types/analysis";
import type { Skill, FunnelResult } from "@/types/analysis";
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
  datedRolesComplete: true,
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

  // A B.S. holder against multi-level phrasing: the LOWEST level a requirement
  // names is the one that satisfies it, not the highest (Math.max is only
  // correct on the resume/held side).
  it("'Bachelor's or Master's degree' passes a B.S. holder", () => {
    expect(evaluateKnockoutGate([req("degree", "Bachelor's or Master's degree")], CTX).checks[0].verdict).toBe("pass");
  });

  it("'BS/MS in Computer Science' passes a B.S. holder", () => {
    expect(evaluateKnockoutGate([req("degree", "BS/MS in Computer Science")], CTX).checks[0].verdict).toBe("pass");
  });

  it("'Bachelor's required, Master's preferred' passes a B.S. holder", () => {
    expect(evaluateKnockoutGate([req("degree", "Bachelor's required, Master's preferred")], CTX).checks[0].verdict).toBe("pass");
  });

  it("a plain 'Master's degree' still fails a B.S. holder", () => {
    expect(evaluateKnockoutGate([req("degree", "Master's degree")], CTX).checks[0].verdict).toBe("fail");
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

  it("a shortfall computed from an INCOMPLETE dated-role set is unverifiable, not a fail", () => {
    const ctx = { ...CTX, totalExperienceMonths: 36, datedRolesComplete: false };
    const gate = evaluateKnockoutGate([req("years_experience", "5")], ctx);
    expect(gate.checks[0].verdict).toBe("unverifiable");
  });

  it("a shortfall computed from a COMPLETE dated-role set still fails", () => {
    const ctx = { ...CTX, totalExperienceMonths: 36, datedRolesComplete: true };
    expect(evaluateKnockoutGate([req("years_experience", "5")], ctx).checks[0].verdict).toBe("fail");
  });

  it("an incomplete dated-role set that already clears the bar still passes", () => {
    const ctx = { ...CTX, totalExperienceMonths: 72, datedRolesComplete: false };
    expect(evaluateKnockoutGate([req("years_experience", "5")], ctx).checks[0].verdict).toBe("pass");
  });
});

describe("evaluateKnockoutGate — certification", () => {
  it("passes when the certification appears verbatim in the resume", () => {
    const ctx = { ...CTX, resumeText: `${CTX.resumeText}\nAWS Solutions Architect, 2024` };
    expect(evaluateKnockoutGate([req("certification", "AWS Solutions Architect")], ctx).checks[0].verdict).toBe("pass");
  });

  it("fails when none of the words appear at all", () => {
    expect(evaluateKnockoutGate([req("certification", "AWS Solutions Architect")], CTX).checks[0].verdict).toBe("fail");
  });

  it("scattered, non-contiguous words are unverifiable, never a pass", () => {
    const ctx = {
      ...CTX,
      resumeText: `${CTX.resumeText}\nAWS certified. Delivered solutions as a Senior Architect.`,
    };
    const gate = evaluateKnockoutGate([req("certification", "AWS Solutions Architect")], ctx);
    expect(gate.checks[0].verdict).toBe("unverifiable");
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

  // normalizeRequirementType maps "license"/"licence" onto "certification", so
  // the model can file a work-eligibility condition under a type the honesty
  // guarantee doesn't recognize by name alone — it must recognize the wording.
  it("an eligibility condition filed under an unrelated type is still unverifiable", () => {
    const gate = evaluateKnockoutGate(
      [req("certification", "authorized to work in the US")],
      CTX
    );
    expect(gate.checks[0].verdict).toBe("unverifiable");
    expect(gate.checks[0].verdict).not.toBe("fail");
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

const NO_METRICS = {
  total_experience_months: 0,
  last_used_months_ago: null,
  avg_tenure_months: null,
  gap_months: [] as number[],
};

const mkSkill = (name: string, over: Partial<Skill> = {}): Skill => ({
  name, present_in_resume: true, category: "technical", match_strength: "exact", ...over,
});

describe("buildSignals", () => {
  it("reports total experience against the posting's requirement", () => {
    const s = buildSignals({
      mustHave: [], requiredYears: 5,
      metrics: { ...NO_METRICS, total_experience_months: 40 },
    });
    const total = s.find((x) => x.key === "total_experience");
    expect(total?.value).toBe("3y 4m");
    expect(total?.detail).toContain("5 years");
  });

  it("omits total experience when nothing is dated", () => {
    expect(buildSignals({ mustHave: [], requiredYears: 5, metrics: NO_METRICS })
      .some((x) => x.key === "total_experience")).toBe(false);
  });

  it("flags must-have skills last used over two years ago", () => {
    const s = buildSignals({
      mustHave: [mkSkill("Perl", { last_used_months_ago: 40 }), mkSkill("React", { last_used_months_ago: 2 })],
      requiredYears: null, metrics: NO_METRICS,
    });
    const stale = s.find((x) => x.key === "skill_recency");
    expect(stale?.value).toBe("1");
    expect(stale?.detail).toContain("Perl");
  });

  it("surfaces gaps only when work-history reported them", () => {
    expect(buildSignals({ mustHave: [], requiredYears: null, metrics: NO_METRICS })
      .some((x) => x.key === "employment_gaps")).toBe(false);
    const s = buildSignals({
      mustHave: [], requiredYears: null,
      metrics: { ...NO_METRICS, gap_months: [8, 14] },
    });
    const gaps = s.find((x) => x.key === "employment_gaps");
    expect(gaps?.value).toBe("2");
    expect(gaps?.detail).toContain("1y 2m");
  });

  it("counts weak-tier must-haves as unevidenced", () => {
    const s = buildSignals({
      mustHave: [mkSkill("Go", { strength: "weak" }), mkSkill("React", { strength: "strong" })],
      requiredYears: null, metrics: NO_METRICS,
    });
    expect(s.find((x) => x.key === "unevidenced_skills")?.value).toBe("1");
  });

  it("reads correctly when exactly one skill is unevidenced", () => {
    const s = buildSignals({
      mustHave: [mkSkill("Go", { strength: "weak" })],
      requiredYears: null, metrics: NO_METRICS,
    });
    const signal = s.find((x) => x.key === "unevidenced_skills");
    expect(signal?.value).toBe("1");
    expect(signal?.detail).toContain("Go appears in a list");
    expect(signal?.detail).not.toContain("appear in");
  });

  it("never emits a combined score", () => {
    const s = buildSignals({
      mustHave: [mkSkill("Go", { strength: "weak" })],
      requiredYears: 5,
      metrics: { total_experience_months: 40, last_used_months_ago: 2, avg_tenure_months: 20, gap_months: [8] },
    });
    expect(s.every((x) => typeof x.value === "string")).toBe(true);
    expect(s.some((x) => x.key === ("overall" as never))).toBe(false);
  });
});

describe("firstRequiredYears", () => {
  it("reads the first years_experience requirement", () => {
    expect(firstRequiredYears([req("degree", "Bachelor's"), req("years_experience", "5+ years")])).toBe(5);
  });

  it("is null when the posting states none", () => {
    expect(firstRequiredYears([req("degree", "Bachelor's")])).toBeNull();
  });

  it("prefers a required years item over a preferred one, regardless of order", () => {
    expect(
      firstRequiredYears([req("years_experience", "3", false), req("years_experience", "5")])
    ).toBe(5);
  });

  it("falls back to a preferred years item only when no required one exists", () => {
    expect(firstRequiredYears([req("years_experience", "3", false)])).toBe(3);
  });
});

describe("deriveFunnelVerdict", () => {
  const funnel = (over: Partial<FunnelResult>): FunnelResult => ({
    parse: { verdict: "clean", reasons: [] },
    knockout: { verdict: "pass", stated: true, checks: [] },
    retrieve: { queries: [], surfaced: 4, total: 4, misses: [] },
    signals: [],
    ...over,
  });

  it("all three gates clear is strong", () => {
    expect(deriveFunnelVerdict(funnel({}))).toBe("strong");
  });

  it("a failed required knockout is critical", () => {
    expect(deriveFunnelVerdict(funnel({ knockout: { verdict: "fail", stated: true, checks: [] } }))).toBe("critical");
  });

  it("a parse that likely breaks is needs_work", () => {
    expect(deriveFunnelVerdict(funnel({ parse: { verdict: "likely_breaks", reasons: [] } }))).toBe("needs_work");
  });

  it("missing a majority of searches is needs_work", () => {
    expect(deriveFunnelVerdict(funnel({
      retrieve: { queries: [], surfaced: 1, total: 4, misses: ["a", "b", "c"] },
    }))).toBe("needs_work");
  });

  it("a partially clear funnel is moderate", () => {
    expect(deriveFunnelVerdict(funnel({ parse: { verdict: "risky", reasons: [] } }))).toBe("moderate");
    expect(deriveFunnelVerdict(funnel({
      retrieve: { queries: [], surfaced: 3, total: 4, misses: ["a"] },
    }))).toBe("moderate");
    expect(deriveFunnelVerdict(funnel({
      knockout: { verdict: "unverifiable", stated: true, checks: [] },
    }))).toBe("moderate");
  });

  it("exactly half the searches missed is moderate, not needs_work", () => {
    expect(deriveFunnelVerdict(funnel({
      retrieve: { queries: [], surfaced: 2, total: 4, misses: ["a", "b"] },
    }))).toBe("moderate");
  });

  it("a failed knockout outranks a broken parse", () => {
    expect(deriveFunnelVerdict(funnel({
      knockout: { verdict: "fail", stated: true, checks: [] },
      parse: { verdict: "likely_breaks", reasons: [] },
    }))).toBe("critical");
  });

  // CRITICAL 1 — a gate that was never actually checked must not read as
  // cleared. evaluateKnockoutGate returns stated=false (a clean pass) when the
  // posting names no required condition; without capping the verdict, this
  // reads identically to a posting whose stated conditions were all verified.
  it("an unstated knockout (nothing was checked) caps at moderate, not strong", () => {
    expect(deriveFunnelVerdict(funnel({
      knockout: { verdict: "pass", stated: false, checks: [] },
    }))).toBe("moderate");
  });

  it("zero retrievable must-haves (no searches ran) caps at moderate, not strong", () => {
    expect(deriveFunnelVerdict(funnel({
      retrieve: { queries: [], surfaced: 0, total: 0, misses: [] },
    }))).toBe("moderate");
  });

  it("a required knockout failure still outranks an unchecked gate", () => {
    expect(deriveFunnelVerdict(funnel({
      knockout: { verdict: "fail", stated: true, checks: [] },
      retrieve: { queries: [], surfaced: 0, total: 0, misses: [] },
    }))).toBe("critical");
  });
});

describe("buildFunnel", () => {
  it("assembles all three gates and the signals from one input", () => {
    const out = buildFunnel({
      structured: withEducation(["B.S. Computer Science, State University"]),
      audit: CLEAN_AUDIT,
      resumeText: "Senior Engineer at Acme. Built with React and SQL. B.S. Computer Science",
      requirements: [req("degree", "Bachelor's degree"), req("years_experience", "5")],
      mustHave: [mkSkill("React"), mkSkill("SQL")],
      metrics: { ...NO_METRICS, total_experience_months: 72, avg_tenure_months: 24 },
      hasDatedRoles: true,
      datedRolesComplete: true,
    });
    expect(out.parse.verdict).toBe("clean");
    expect(out.knockout.verdict).toBe("pass");
    expect(out.retrieve.misses).toEqual([]);
    expect(out.signals.map((s) => s.key)).toContain("total_experience");
    expect(deriveFunnelVerdict(out)).toBe("strong");
  });
});
