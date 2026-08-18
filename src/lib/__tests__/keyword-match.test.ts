import { describe, it, expect } from "vitest";
import { buildSkills, extractBonusSkills, clipJd, sanitizeSkillName, isNegatedInJd } from "@/lib/keyword-match";
import { extractResumeStructure } from "@/lib/ats-extract";
import { segmentRoles } from "@/lib/work-history";

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

  it("multiword skill missing one of its words does not match", () => {
    const [s] = buildSkills(["REST API design"], RESUME);
    expect(s.match_strength).toBe("missing");
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

describe("buildSkills word-level fallback", () => {
  const RESUME_LEARNING = `EXPERIENCE
• Improved learning agility across the team
• Ran project retrospectives`;

  it("does not match a multi-word skill on a single shared word", () => {
    const [s] = buildSkills(["Machine Learning"], RESUME_LEARNING);
    expect(s.match_strength).toBe("missing");
    expect(s.present_in_resume).toBe(false);
  });

  it("does not match Project Management on the word project alone", () => {
    const [s] = buildSkills(["Project Management"], RESUME_LEARNING);
    expect(s.match_strength).toBe("missing");
  });

  it("matches a contiguous multi-word phrase exactly", () => {
    // Contiguous text hits the exact branch and never reaches the word
    // fallback, so this is "exact", not "partial".
    const [s] = buildSkills(["Machine Learning"], "Built machine learning pipelines in production");
    expect(s.match_strength).toBe("exact");
  });

  it("matches a multi-word skill whose words are present but not adjacent", () => {
    // This is the case that actually exercises the all-word fallback.
    const [s] = buildSkills(["Machine Learning"], "Applied learning methods to machine vision");
    expect(s.match_strength).toBe("partial");
  });
});

const EVIDENCE_RESUME = `Jane Doe
EXPERIENCE
Backend Engineer, Acme — May 2024 to Present
• Built services in Go and deployed with Kubernetes
Junior Developer, Initech — Jan 2016 to Jan 2017
• Wrote COBOL batch jobs
SKILLS
Rust, Go, Kubernetes, COBOL`;

const NOW_E = new Date("2026-08-17T00:00:00Z");

describe("evidence-based strength", () => {
  const structured = extractResumeStructure(EVIDENCE_RESUME);
  const roles = segmentRoles(structured, [
    { header_line: "Backend Engineer, Acme — May 2024 to Present", employer: "Acme", title: "Backend Engineer", start: "May 2024", end: "Present" },
    { header_line: "Junior Developer, Initech — Jan 2016 to Jan 2017", employer: "Initech", title: "Junior Developer", start: "Jan 2016", end: "Jan 2017" },
  ]);
  const opts = { structured, roles, now: NOW_E };

  it("rates a recent long-held role skill as strong", () => {
    const [s] = buildSkills(["Kubernetes"], EVIDENCE_RESUME, opts);
    expect(s.strength).toBe("strong");
    expect(s.evidence?.roles[0].title).toBe("Backend Engineer");
    expect(s.last_used_months_ago).toBe(0);
  });

  it("rates a stale role skill as moderate", () => {
    const [s] = buildSkills(["COBOL"], EVIDENCE_RESUME, opts);
    expect(s.strength).toBe("moderate");
  });

  it("rates a skills-list-only claim as weak", () => {
    const [s] = buildSkills(["Rust"], EVIDENCE_RESUME, opts);
    expect(s.strength).toBe("weak");
    expect(s.evidence?.roles).toEqual([]);
  });

  it("rates an absent skill as missing with null evidence", () => {
    const [s] = buildSkills(["Haskell"], EVIDENCE_RESUME, opts);
    expect(s.strength).toBe("missing");
    expect(s.evidence).toBeNull();
  });

  it("caps at moderate when the role dates did not parse", () => {
    const undated = segmentRoles(structured, [
      { header_line: "Backend Engineer, Acme — May 2024 to Present", employer: "Acme", title: "Backend Engineer", start: "whenever", end: "whenever" },
    ]);
    const [s] = buildSkills(["Kubernetes"], EVIDENCE_RESUME, { structured, roles: undated, now: NOW_E });
    expect(s.strength).toBe("moderate");
  });

  it("keeps match_strength populated for old-history compatibility", () => {
    const [s] = buildSkills(["Kubernetes"], EVIDENCE_RESUME, opts);
    expect(s.match_strength).toBe("exact");
  });

  it("omits the new fields entirely when no roles are supplied", () => {
    const [s] = buildSkills(["Kubernetes"], EVIDENCE_RESUME);
    expect(s.strength).toBeUndefined();
    expect(s.match_strength).toBe("exact");
  });
});
