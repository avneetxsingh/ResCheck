import { describe, it, expect } from "vitest";
import {
  extractResumeStructure,
  toAtsExtraction,
  buildSectionizedText,
  sectionNames,
} from "@/lib/ats-extract";
import { evaluateParseGate } from "@/lib/funnel";
import type { FormattingAudit } from "@/types/analysis";

const CLEAN_AUDIT: FormattingAudit = {
  whitespace_issues: [], bold_inconsistencies: [], bullet_inconsistencies: [],
  date_format_issues: [], capitalization_issues: [], other_inconsistencies: [],
  is_clean: true,
};

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

describe("what the parser dropped", () => {
  const bare = "Jane Doe\njane@example.com\n555-555-5555\nSome prose with no headings at all.";

  it("reports only core sections as missing, never projects or certifications", () => {
    const x = toAtsExtraction(extractResumeStructure(bare));
    expect(x.sections_missing).toEqual(
      expect.arrayContaining(["experience", "education", "skills"])
    );
    expect(x.sections_missing).not.toContain("projects");
    expect(x.sections_missing).not.toContain("certifications");
  });

  it("reports nothing missing when every core section is detected", () => {
    const full = [
      "EXPERIENCE", "Acme Corp", "EDUCATION", "State University", "SKILLS", "Go, TypeScript",
    ].join("\n");
    expect(toAtsExtraction(extractResumeStructure(full)).sections_missing).toEqual([]);
  });

  // The actionable half: the heading word IS in the document, on a known line,
  // and the sectionizer read it as body text because the line exceeds 40 chars.
  it("recovers a heading the sectionizer rejected, with its line number", () => {
    const merged = [
      "Jane Doe                           SKILLS",
      "Senior Engineer                    TypeScript, Go",
      "jane@example.com                   Terraform",
      "Portfolio: janedoe.dev             AWS, Docker",
      "Acme Corp                          EDUCATION",
    ].join("\n");
    const x = toAtsExtraction(extractResumeStructure(merged));
    const found = x.sections_unrecognized ?? [];
    expect(found.some((u) => u.section === "skills" && u.line_number === 1)).toBe(true);
    expect(found.find((u) => u.section === "skills")?.text).toBe(merged.split("\n")[0]);
  });

  it("warns about merged columns in the parse warnings", () => {
    const merged = [
      "Jane Doe                           SKILLS",
      "Senior Engineer                    TypeScript, Go",
      "jane@example.com                   Terraform",
      "Portfolio: janedoe.dev             AWS, Docker",
      "Acme Corp                          EDUCATION",
    ].join("\n");
    const s = extractResumeStructure(merged);
    expect(s.warnings.some((w) => /column/i.test(w))).toBe(true);
    expect(toAtsExtraction(s).column_evidence?.length).toBeGreaterThan(0);
  });

  // Calls the actual gate rather than only checking the warning string, so a
  // regression that decoupled the warning from evaluateParseGate would be caught.
  it("downgrades the parse gate when columns look merged", () => {
    // Real headings (experience/education/skills) and contact are present, so
    // the gate cannot already be non-clean for those reasons — a stranded
    // "CERTIFICATIONS" fragment plus three ordinary gapped body lines are the
    // only thing left to move the verdict off "clean".
    const merged = [
      "Jane Doe",
      "jane@example.com | 555-123-4567",
      "",
      "EXPERIENCE",
      "Senior Engineer, Acme Corp",
      "Built dashboards in React                    Led migration to TypeScript",
      "Owned the on-call rotation                    Ran the platform design review",
      "Shipped v2 of the API                         Cut infra cost by a fifth",
      "Random note                                    CERTIFICATIONS",
      "EDUCATION",
      "B.S. Computer Science, 2019",
      "SKILLS",
      "JavaScript, Python, SQL",
    ].join("\n");
    const structured = extractResumeStructure(merged);
    expect(toAtsExtraction(structured).column_evidence?.length).toBeGreaterThan(0);
    const gate = evaluateParseGate(structured, CLEAN_AUDIT);
    expect(gate.verdict).not.toBe("clean");
  });

  it("adds no column warning to an ordinary single-column résumé", () => {
    // Includes a stranded heading (PROJECTS, never detected as a real
    // section elsewhere) so headingsMidLine fires. The résumé staying column-
    // warning-free then depends entirely on isDateRange filtering the three
    // gapped date lines below MIN_INTERIOR_GAPS — a fixture with no stranded
    // heading would pass even if the date filter were deleted.
    const plain = [
      "EXPERIENCE",
      "Acme Corp                          2020 - 2023",
      "Globex Inc                         2018 - 2020",
      "Initech                            2015 - 2018",
      "Beta LLC                           PROJECTS",
    ].join("\n");
    const s = extractResumeStructure(plain);
    expect(s.warnings.some((w) => /column/i.test(w))).toBe(false);
  });
});

describe("garbled-character warning", () => {
  it("says 'character' for one and 'characters' for several", () => {
    const one = extractResumeStructure("Jane\u{FFFD}Doe").warnings.join(" ");
    expect(one).toContain("1 garbled character ");
    expect(one).not.toContain("character(s)");
    const many = extractResumeStructure("Jane\u{FFFD}\u{FFFD}Doe").warnings.join(" ");
    expect(many).toContain("2 garbled characters ");
  });
});
