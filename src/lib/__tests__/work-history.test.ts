import { describe, it, expect } from "vitest";
import { parseResumeDate, computeWorkHistoryMetrics, segmentRoles } from "@/lib/work-history";
import { extractResumeStructure } from "@/lib/ats-extract";

const NOW = new Date("2026-08-17T00:00:00Z");

describe("parseResumeDate", () => {
  it("parses a month-name form", () => {
    expect(parseResumeDate("May 2020")).toEqual({ year: 2020, month: 5, precision: "month" });
  });

  it("parses a numeric form", () => {
    expect(parseResumeDate("05/2020")).toEqual({ year: 2020, month: 5, precision: "month" });
  });

  it("treats a year-only form as January, flagged low precision", () => {
    expect(parseResumeDate("2020")).toEqual({ year: 2020, month: 1, precision: "year" });
  });

  it("resolves Present/Current/Now to the present marker", () => {
    for (const raw of ["Present", "current", "NOW"]) {
      expect(parseResumeDate(raw)).toEqual({ year: null, month: null, precision: "present" });
    }
  });

  it("returns null rather than guessing an unparseable date", () => {
    expect(parseResumeDate("sometime last summer")).toBeNull();
    expect(parseResumeDate("")).toBeNull();
  });
});

describe("computeWorkHistoryMetrics", () => {
  it("unions overlapping ranges instead of summing them", () => {
    // 2018-01..2021-01 (36mo) fully contains 2019-01..2020-01 (12mo).
    // Summing would give 48; the union is 36.
    const m = computeWorkHistoryMetrics(
      [
        { start: { year: 2018, month: 1, precision: "month" }, end: { year: 2021, month: 1, precision: "month" } },
        { start: { year: 2019, month: 1, precision: "month" }, end: { year: 2020, month: 1, precision: "month" } },
      ],
      NOW
    );
    expect(m.total_experience_months).toBe(36);
  });

  it("treats a Present end as running to now and reports zero recency", () => {
    const m = computeWorkHistoryMetrics(
      [{ start: { year: 2025, month: 8, precision: "month" }, end: { year: null, month: null, precision: "present" } }],
      NOW
    );
    expect(m.total_experience_months).toBe(12);
    expect(m.last_used_months_ago).toBe(0);
  });

  it("reports gaps longer than six months", () => {
    const m = computeWorkHistoryMetrics(
      [
        { start: { year: 2018, month: 1, precision: "month" }, end: { year: 2019, month: 1, precision: "month" } },
        { start: { year: 2020, month: 6, precision: "month" }, end: { year: 2021, month: 6, precision: "month" } },
      ],
      NOW
    );
    expect(m.gap_months).toEqual([17]);
  });

  it("ignores ranges whose dates did not parse", () => {
    const m = computeWorkHistoryMetrics([{ start: null, end: null }], NOW);
    expect(m.total_experience_months).toBe(0);
    expect(m.last_used_months_ago).toBeNull();
  });
});

const RESUME_WITH_ROLES = `Jane Doe
EXPERIENCE
Backend Engineer, Acme — May 2020 to Present
• Built REST APIs with Node.js
• Scaled Postgres to 2M rows
Junior Developer, Initech — Jan 2018 to Apr 2020
• Wrote Python scripts
SKILLS
JavaScript, React, Docker`;

describe("segmentRoles", () => {
  const structured = extractResumeStructure(RESUME_WITH_ROLES);

  it("segments a role block from its header to the next header", () => {
    const roles = segmentRoles(structured, [
      { header_line: "Backend Engineer, Acme — May 2020 to Present", employer: "Acme", title: "Backend Engineer", start: "May 2020", end: "Present" },
      { header_line: "Junior Developer, Initech — Jan 2018 to Apr 2020", employer: "Initech", title: "Junior Developer", start: "Jan 2018", end: "Apr 2020" },
    ]);
    expect(roles).toHaveLength(2);
    expect(roles[0].text).toContain("Built REST APIs with Node.js");
    expect(roles[0].text).toContain("Scaled Postgres");
    expect(roles[0].text).not.toContain("Wrote Python scripts");
    expect(roles[0].anchored).toBe(true);
  });

  it("tolerates whitespace differences between the model's copy and the resume", () => {
    const roles = segmentRoles(structured, [
      { header_line: "Backend   Engineer,  Acme — May 2020 to Present", employer: "Acme", title: "Backend Engineer", start: "May 2020", end: "Present" },
    ]);
    expect(roles[0].anchored).toBe(true);
  });

  it("keeps dates but yields no text when the anchor cannot be located", () => {
    const roles = segmentRoles(structured, [
      { header_line: "Staff Engineer at a company never mentioned", employer: "Ghost", title: "Staff Engineer", start: "Jan 2015", end: "Dec 2016" },
    ]);
    expect(roles[0].anchored).toBe(false);
    expect(roles[0].text).toBe("");
    expect(roles[0].range.start).toEqual({ year: 2015, month: 1, precision: "month" });
  });

  it("returns an empty array when the model reported no roles", () => {
    expect(segmentRoles(structured, [])).toEqual([]);
  });
});
