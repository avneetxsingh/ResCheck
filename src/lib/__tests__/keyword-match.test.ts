import { describe, it, expect } from "vitest";
import { buildSkills, extractBonusSkills, clipJd, sanitizeSkillName, isNegatedInJd } from "@/lib/keyword-match";
import { extractResumeStructure } from "@/lib/ats-extract";

const RESUME = `Jane Doe
EXPERIENCE
• Built REST APIs with Node.js and deployed on k8s
• Improved communication across teams
SKILLS
JavaScript, React, Docker, Figma`;

describe("buildSkills", () => {
  it("marks a verbatim skill as exact and present", () => {
    const [s] = buildSkills(["React"], RESUME);
    expect(s).toMatchObject({ name: "React", present_in_resume: true, match_strength: "exact" });
  });

  it("matches via alias table as partial and present (k8s → Kubernetes)", () => {
    const [s] = buildSkills(["Kubernetes"], RESUME);
    expect(s.present_in_resume).toBe(true);
    expect(s.match_strength).toBe("partial");
  });

  it("marks an absent skill as missing and not present", () => {
    const [s] = buildSkills(["Rust"], RESUME);
    expect(s).toMatchObject({ present_in_resume: false, match_strength: "missing" });
  });

  it("multiword skill with half its words found is partial but not present", () => {
    const [s] = buildSkills(["REST API design"], RESUME);
    expect(s.match_strength).toBe("partial");
    expect(s.present_in_resume).toBe(false);
  });

  it("does not substring-match inside words (Java vs JavaScript)", () => {
    const [s] = buildSkills(["Java"], RESUME);
    expect(s.match_strength).toBe("missing");
  });

  it("classifies categories: soft, tool, technical", () => {
    const skills = buildSkills(["Communication", "Docker", "React"], RESUME);
    expect(skills.map((s) => s.category)).toEqual(["soft", "tool", "technical"]);
  });

  it("dedupes repeated names", () => {
    expect(buildSkills(["React", "react"], RESUME)).toHaveLength(1);
  });

  it("matches a degree requirement against how resumes actually write it", () => {
    const [s] = buildSkills(["Bachelor's degree"], "EDUCATION\nBachelor of Science in Computer Science");
    expect(s.present_in_resume).toBe(true);
    expect(s.match_strength).toBe("partial");
  });

  it("matches Next.js against NextJS via alias", () => {
    const [s] = buildSkills(["Next.js"], "Built dashboards with NextJS and Tailwind");
    expect(s.present_in_resume).toBe(true);
    expect(s.match_strength).toBe("partial");
  });
});

describe("clipJd", () => {
  it("returns short text unchanged", () => {
    expect(clipJd("short posting", 4000)).toBe("short posting");
  });

  it("keeps the requirements section of a long posting instead of truncating it away", () => {
    const jd = "About us. ".repeat(300) + "\nRequirements\nPython, SQL, Airflow";
    const clipped = clipJd(jd, 1000);
    expect(clipped).toContain("Python, SQL, Airflow");
    expect(clipped.length).toBeLessThanOrEqual(1005);
  });

  it("falls back to the tail when no requirements marker exists", () => {
    const jd = "blah ".repeat(500) + "FINAL_DETAILS";
    expect(clipJd(jd, 1000)).toContain("FINAL_DETAILS");
  });
});

describe("extractBonusSkills", () => {
  it("returns skills-section entries not asked for by the JD", () => {
    const bonus = extractBonusSkills(extractResumeStructure(RESUME), ["JavaScript", "React"]);
    expect(bonus).toContain("Docker");
    expect(bonus).toContain("Figma");
    expect(bonus).not.toContain("JavaScript");
    expect(bonus).not.toContain("React");
  });

  it("returns [] when there is no skills section", () => {
    const bonus = extractBonusSkills(extractResumeStructure("Jane\nEXPERIENCE\nEngineer"), []);
    expect(bonus).toEqual([]);
  });
});

describe("sanitizeSkillName", () => {
  it("salvages a skill buried under a stock prefix", () => {
    expect(sanitizeSkillName("Experience with Kubernetes")).toBe("Kubernetes");
    expect(sanitizeSkillName("Knowledge of GraphQL")).toBe("GraphQL");
    expect(sanitizeSkillName("Proficiency in SQL")).toBe("SQL");
  });

  it("strips a years-of qualifier", () => {
    expect(sanitizeSkillName("5+ years of Python")).toBe("Python");
  });

  it("passes an already-atomic skill through unchanged", () => {
    expect(sanitizeSkillName("React")).toBe("React");
    expect(sanitizeSkillName("Amazon Web Services")).toBe("Amazon Web Services");
  });

  it("rejects a whole sentence lifted from the job description", () => {
    expect(sanitizeSkillName("Experience building scalable distributed systems in a cloud environment")).toBeNull();
  });

  it("rejects a phrase that is still abstract after stripping", () => {
    expect(sanitizeSkillName("Excellent communication and interpersonal abilities")).toBeNull();
  });

  it("rejects fragments carrying sentence punctuation", () => {
    expect(sanitizeSkillName("Python, Java; and Go")).toBeNull();
  });

  it("rejects empty and whitespace input", () => {
    expect(sanitizeSkillName("   ")).toBeNull();
  });
});

describe("isNegatedInJd", () => {
  it("detects a negated requirement", () => {
    expect(isNegatedInJd("Kubernetes", "No Kubernetes experience required for this role.")).toBe(true);
  });

  it("does not treat an ordinary mention as negated", () => {
    expect(isNegatedInJd("Kubernetes", "Deep Kubernetes experience required.")).toBe(false);
  });

  it("does not let a negation in a different sentence bleed across", () => {
    expect(isNegatedInJd("Python", "No travel required. Python is essential.")).toBe(false);
  });

  it("does not let a negation bleed across a comma", () => {
    expect(isNegatedInJd("Python", "No Java required, Python is essential")).toBe(false);
  });

  it("treats a skill as required when any occurrence is affirmative", () => {
    expect(isNegatedInJd("SQL", "No SQL certification required. Must have strong SQL skills.")).toBe(false);
  });

  it("still negates when every occurrence is negated", () => {
    expect(isNegatedInJd("Kubernetes", "No Kubernetes needed, and no Kubernetes experience expected.")).toBe(true);
  });
});
