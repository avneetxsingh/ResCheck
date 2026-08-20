import { describe, it, expect } from "vitest";
import { evaluateParseGate } from "@/lib/funnel";
import type { FormattingAudit } from "@/types/analysis";
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
