import { describe, it, expect } from "vitest";
import { buildSkills, extractBonusSkills } from "@/lib/keyword-match";
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
