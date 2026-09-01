import { describe, it, expect } from "vitest";
import { extractResumeStructure } from "@/lib/ats-extract";
import { runFormattingAudit } from "@/lib/formatting-audit";

function audit(text: string) {
  return runFormattingAudit(extractResumeStructure(text));
}

describe("runFormattingAudit", () => {
  it("is clean on a clean resume", () => {
    const a = audit("Jane\nEXPERIENCE\n• Built APIs in Python.\n• Led a team of 5.");
    expect(a.is_clean).toBe(true);
    expect(a.whitespace_issues).toEqual([]);
  });

  it("flags double spaces with a verbatim quote", () => {
    const a = audit("Jane\nEXPERIENCE\n• Led a team  of 5.");
    expect(a.whitespace_issues.length).toBe(1);
    expect(a.whitespace_issues[0]).toContain("team  of");
    expect(a.is_clean).toBe(false);
  });

  it("flags a comma with no following space, but not numbers like 1,000", () => {
    const a = audit("Jane\nEXPERIENCE\n• Shipped features,fixed bugs\n• Saved $1,000");
    expect(a.whitespace_issues.length).toBe(1);
    expect(a.whitespace_issues[0]).toContain("features,fixed");
  });

  it("flags mixed bullet characters within one section, quoting both", () => {
    const a = audit("Jane\nEXPERIENCE\n• Built APIs\n- Led migrations");
    expect(a.bullet_inconsistencies.length).toBe(1);
    expect(a.bullet_inconsistencies[0]).toContain("Built APIs");
    expect(a.bullet_inconsistencies[0]).toContain("Led migrations");
  });

  it("flags mixed period endings when a section has 3+ bullets", () => {
    const a = audit("Jane\nEXPERIENCE\n• Built APIs.\n• Led migrations\n• Shipped features.");
    expect(a.bullet_inconsistencies.some((i) => i.includes("period"))).toBe(true);
  });

  it("flags mixed date formats across the resume, quoting both styles", () => {
    const a = audit("Jane\nEXPERIENCE\nAcme, Jan 2023 - Present\nBeta Corp, January 2020 to 2022");
    expect(a.date_format_issues.length).toBe(1);
    expect(a.date_format_issues[0]).toContain("Jan 2023");
    expect(a.date_format_issues[0]).toContain("January 2020");
  });

  it("does not flag a single consistent date style", () => {
    const a = audit("Jane\nEXPERIENCE\nAcme, Jan 2023\nBeta, Feb 2020");
    expect(a.date_format_issues).toEqual([]);
  });

  it("flags lowercase proper nouns from the dictionary", () => {
    const a = audit("Jane\nSKILLS\njavascript, Python, SQL");
    expect(a.capitalization_issues.length).toBe(1);
    expect(a.capitalization_issues[0]).toContain("javascript");
    expect(a.capitalization_issues[0]).toContain("JavaScript");
  });

  it("skips proper-noun checks on lines containing URLs or emails", () => {
    const a = audit("Jane\nCONTACT me at jane@github.com\nSKILLS\nPython");
    expect(a.capitalization_issues).toEqual([]);
  });

  it("does not flag a bare-domain profile URL on its own line", () => {
    const a = audit("Jane\ngithub.com/jane\nSKILLS\nPython");
    expect(a.capitalization_issues).toEqual([]);
  });

  it("still flags a real lowercase proper noun on a line that also holds a URL", () => {
    const a = audit("Jane\nSKILLS\ngithub.com/jane and javascript experience");
    expect(a.capitalization_issues.some((i) => i.includes("javascript"))).toBe(true);
    expect(a.capitalization_issues.some((i) => i.includes("'github'"))).toBe(false);
  });

  it("flags mixed heading casing styles", () => {
    const a = audit("Jane\nEXPERIENCE\nAcme engineer\nSkills\nPython");
    expect(a.capitalization_issues.some((i) => i.includes("EXPERIENCE") && i.includes("Skills"))).toBe(true);
  });
});
