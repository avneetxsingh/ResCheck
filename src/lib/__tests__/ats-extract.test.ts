import { describe, it, expect } from "vitest";
import {
  extractResumeStructure,
  toAtsExtraction,
  buildSectionizedText,
  sectionNames,
} from "@/lib/ats-extract";

const SAMPLE = `Avneet Singh
avneet@example.com | (555) 123-4567 | linkedin.com/in/avneet

PROFESSIONAL SUMMARY
Software engineer with 5 years of experience.

EXPERIENCE
Software Engineer, Acme Corp
• Built dashboards in React
• Led migration to TypeScript

EDUCATION
B.S. Computer Science, 2019

Skills
JavaScript, Python, SQL`;

describe("extractResumeStructure", () => {
  it("detects standard section headings", () => {
    const s = extractResumeStructure(SAMPLE);
    const names = s.sections.map((b) => b.name);
    expect(names).toContain("summary");
    expect(names).toContain("experience");
    expect(names).toContain("education");
    expect(names).toContain("skills");
  });

  it("treats the preamble as the contact block", () => {
    const s = extractResumeStructure(SAMPLE);
    expect(s.sections[0].name).toBe("contact");
    expect(s.sections[0].heading).toBe("");
    expect(s.sections[0].lines[0]).toBe("Avneet Singh");
  });

  it("extracts email, phone, and links", () => {
    const s = extractResumeStructure(SAMPLE);
    expect(s.contact.email).toBe("avneet@example.com");
    expect(s.contact.phone).toContain("555");
    expect(s.contact.links.some((l) => l.includes("linkedin.com"))).toBe(true);
  });

  it("does not mistake a date range for a phone number", () => {
    const s = extractResumeStructure("Jane Doe\nEXPERIENCE\nEngineer, 2019 - 2023");
    expect(s.contact.phone).toBeNull();
  });

  it("warns when no email is found", () => {
    const s = extractResumeStructure("Jane Doe\nEXPERIENCE\nEngineer at Acme");
    expect(s.warnings.some((w) => w.toLowerCase().includes("email"))).toBe(true);
  });

  it("warns when no section headings are found", () => {
    const s = extractResumeStructure("just a wall of text with no headings at all");
    expect(s.warnings.some((w) => w.toLowerCase().includes("heading"))).toBe(true);
  });

  it("warns on garbled replacement characters", () => {
    const s = extractResumeStructure("Jane\nEXPERIENCE\nledger � entry");
    expect(s.warnings.some((w) => w.toLowerCase().includes("garbled"))).toBe(true);
  });
});

describe("helpers", () => {
  it("toAtsExtraction lists detected sections excluding the contact preamble", () => {
    const x = toAtsExtraction(extractResumeStructure(SAMPLE));
    expect(x.sections_detected).toEqual(
      expect.arrayContaining(["summary", "experience", "education", "skills"])
    );
    expect(x.sections_detected).not.toContain("contact");
  });

  it("buildSectionizedText tags each block with its section name", () => {
    const text = buildSectionizedText(extractResumeStructure(SAMPLE));
    expect(text).toContain("[EXPERIENCE]");
    expect(text).toContain("[SKILLS]");
  });

  it("sectionNames returns unique names present", () => {
    const names = sectionNames(extractResumeStructure(SAMPLE));
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("experience");
  });
});
