import { describe, it, expect } from "vitest";
import { parseResumeDate, computeWorkHistoryMetrics, segmentRoles, computeEmploymentGaps, formatParsedDate, type RoleBlock } from "@/lib/work-history";
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
    // 2018-01..2021-01 fully contains 2019-01..2020-01. Months are counted
    // inclusively, so the outer span is 37 (Jan 2018 through Jan 2021) and the
    // union is 37 — summing the two spans would wrongly give 50.
    const m = computeWorkHistoryMetrics(
      [
        { start: { year: 2018, month: 1, precision: "month" }, end: { year: 2021, month: 1, precision: "month" } },
        { start: { year: 2019, month: 1, precision: "month" }, end: { year: 2020, month: 1, precision: "month" } },
      ],
      NOW
    );
    expect(m.total_experience_months).toBe(37);
  });

  it("treats a Present end as running to now and reports zero recency", () => {
    const m = computeWorkHistoryMetrics(
      [{ start: { year: 2025, month: 8, precision: "month" }, end: { year: null, month: null, precision: "present" } }],
      NOW
    );
    // Aug 2025 through Aug 2026 inclusive is 13 months.
    expect(m.total_experience_months).toBe(13);
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
    // Idle months are Feb 2019 through May 2020 inclusive: 16, not 17.
    expect(m.gap_months).toEqual([16]);
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

  it("does not corrupt segment boundaries when two roles have the same header line", () => {
    // Internal promotion: same employer, same title, different dates.
    // AI trims date range and reports both with header "Backend Engineer, Acme".
    // Without unique claiming, both would match index 0 and both would receive
    // all remaining text, including the second role's bullets.
    const resumeText = `Jane Doe
EXPERIENCE
Backend Engineer, Acme — May 2020 to July 2020
• Built REST APIs
Backend Engineer, Acme — Aug 2020 to Present
• Improved performance
SKILLS
JavaScript`;

    const structured = extractResumeStructure(resumeText);
    const roles = segmentRoles(structured, [
      { header_line: "Backend Engineer, Acme", employer: "Acme", title: "Backend Engineer", start: "May 2020", end: "July 2020" },
      { header_line: "Backend Engineer, Acme", employer: "Acme", title: "Backend Engineer", start: "Aug 2020", end: "Present" },
    ]);

    expect(roles).toHaveLength(2);
    // First role should contain only its own bullets
    expect(roles[0].text).toContain("Built REST APIs");
    expect(roles[0].text).not.toContain("Improved performance");
    expect(roles[0].anchored).toBe(true);
    // Second role should contain only its own bullets
    expect(roles[1].text).toContain("Improved performance");
    expect(roles[1].text).not.toContain("Built REST APIs");
    expect(roles[1].anchored).toBe(true);
  });
});

describe("section boundaries", () => {
  const RESUME_WITH_PROJECTS = `Jane Doe
EXPERIENCE
Backend Engineer, Acme — Jan 2019 to Dec 2021
• Shipped the billing service
PROJECTS
Open Source CLI
• Built a Rust CLI with 2k stars`;

  it("does not let a role absorb the projects section", () => {
    // Flattening experience and projects into one array dated project work to
    // the last job, giving skills evidence from a role they were never in.
    const structured = extractResumeStructure(RESUME_WITH_PROJECTS);
    const [role] = segmentRoles(structured, [
      { header_line: "Backend Engineer, Acme — Jan 2019 to Dec 2021", employer: "Acme", title: "Backend Engineer", start: "Jan 2019", end: "Dec 2021" },
    ]);
    expect(role.text).toContain("Shipped the billing service");
    expect(role.text).not.toContain("Rust CLI");
  });
});

describe("anchor resolution", () => {
  const PROMOTION_RESUME = `Jane Doe
EXPERIENCE
Senior Software Engineer, Acme — Jan 2021 to Present
• Led the platform team
Software Engineer, Acme — Jan 2018 to Dec 2020
• Built the ingestion service
• Partnered with the acme platform engineer team on integrations`;

  const structured = extractResumeStructure(PROMOTION_RESUME);

  it("anchors a junior role to its own header, not the senior one", () => {
    // "Software Engineer, Acme" is a substring of "Senior Software Engineer,
    // Acme" — taking the first containment match dated this role wrongly.
    const [junior] = segmentRoles(structured, [
      { header_line: "Software Engineer, Acme", employer: "Acme", title: "Software Engineer", start: "Jan 2018", end: "Dec 2020" },
    ]);
    expect(junior.anchored).toBe(true);
    expect(junior.text).toContain("Built the ingestion service");
    expect(junior.text).not.toContain("Led the platform team");
  });

  it("never claims a bullet line as a role header", () => {
    const [role] = segmentRoles(structured, [
      { header_line: "acme platform engineer", employer: "Acme", title: "Engineer", start: "Jan 2018", end: "Dec 2020" },
    ]);
    // The only containment match is a bullet, so this must degrade to
    // unanchored rather than silently anchoring mid-role.
    expect(role.anchored).toBe(false);
    expect(role.text).toBe("");
  });
});

describe("computeEmploymentGaps", () => {
  const role = (employer: string, from: [number, number], to: [number, number]): RoleBlock => ({
    employer,
    title: `${employer} engineer`,
    range: {
      start: { year: from[0], month: from[1], precision: "month" },
      end: { year: to[0], month: to[1], precision: "month" },
    },
    text: "",
    anchored: false,
  });

  it("names the roles on either side of a gap and keeps their dates", () => {
    const gaps = computeEmploymentGaps(
      [role("Acme", [2021, 1], [2023, 3]), role("Globex", [2023, 11], [2024, 6])],
      NOW
    );
    expect(gaps).toHaveLength(1);
    expect(gaps[0].months).toBe(7);
    expect(gaps[0].role_before).toBe("Acme");
    expect(gaps[0].role_after).toBe("Globex");
    expect(formatParsedDate(gaps[0].ended_at)).toBe("Mar 2023");
    expect(formatParsedDate(gaps[0].resumed_at)).toBe("Nov 2023");
  });

  it("ignores a gap at or under the threshold", () => {
    // Mar 2023 -> Sep 2023 is 5 clear months, under the 6-month bar.
    const gaps = computeEmploymentGaps(
      [role("Acme", [2021, 1], [2023, 3]), role("Globex", [2023, 9], [2024, 6])],
      NOW
    );
    expect(gaps).toEqual([]);
  });

  it("does not invent a gap between overlapping roles", () => {
    const gaps = computeEmploymentGaps(
      [role("Acme", [2020, 1], [2024, 1]), role("Moonlight", [2021, 1], [2021, 6])],
      NOW
    );
    expect(gaps).toEqual([]);
  });

  it("returns nothing when no role has parseable dates", () => {
    const undated: RoleBlock = {
      employer: "Acme", title: "Engineer",
      range: { start: null, end: null }, text: "", anchored: false,
    };
    expect(computeEmploymentGaps([undated], NOW)).toEqual([]);
  });

  it("falls back to the title when the employer is blank", () => {
    const blank = role("", [2023, 11], [2024, 6]);
    const gaps = computeEmploymentGaps([role("Acme", [2021, 1], [2023, 3]), blank], NOW);
    expect(gaps[0].role_after).toBe(blank.title);
  });

  // The two gap calculations must never disagree — one drives the signals
  // panel, the other drives the questions, and a user seeing "1 gap" beside a
  // question about a different gap would rightly stop trusting both.
  it("agrees with the month counts computeWorkHistoryMetrics reports", () => {
    const roles = [
      role("Acme", [2018, 1], [2020, 2]),
      role("Globex", [2021, 3], [2022, 1]),
      role("Initech", [2023, 6], [2024, 6]),
    ];
    const viaGaps = computeEmploymentGaps(roles, NOW).map((g) => g.months);
    const viaMetrics = computeWorkHistoryMetrics(roles.map((r) => r.range), NOW).gap_months;
    expect(viaGaps).toEqual(viaMetrics);
  });
});

describe("formatParsedDate", () => {
  it("renders a month-precision date", () => {
    expect(formatParsedDate({ year: 2023, month: 3, precision: "month" })).toBe("Mar 2023");
  });
  it("renders a year-precision date without inventing a month", () => {
    expect(formatParsedDate({ year: 2023, month: null, precision: "year" })).toBe("2023");
  });
  it("renders an ongoing role as present", () => {
    expect(formatParsedDate({ year: null, month: null, precision: "present" })).toBe("present");
  });
});
