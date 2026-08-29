import { describe, it, expect } from "vitest";
import { detectMergedColumns } from "../column-detect";

// A stand-in for ats-extract's matchSectionHeading: same 40-char rule, a few
// of the same words. Injected so column-detect never imports ats-extract.
const matchHeading = (line: string): string | null => {
  const t = line.trim().replace(/:$/, "").trim();
  if (t.length === 0 || t.length > 40) return null;
  if (/^(experience|work experience)$/i.test(t)) return "experience";
  if (/^education$/i.test(t)) return "education";
  // Mirrors ats-extract's real skills pattern (not just the bare word) so the
  // labelled-skills-block regression test below actually exercises the same
  // match the production heading matcher performs.
  if (/^((technical|core|key)\s+)?(skills|competencies|technologies)$/i.test(t)) return "skills";
  return null;
};

const run = (text: string) => detectMergedColumns(text, matchHeading);

describe("detectMergedColumns — the false positive it exists to avoid", () => {
  // THE most important test here. Right-aligned dates are the commonest wide
  // gap on an ordinary one-column résumé. Firing on this would downgrade
  // almost every real user's parse gate.
  it("does not fire on a single-column résumé with right-aligned dates", () => {
    const text = [
      "EXPERIENCE",
      "Acme Corp                          2020 - 2023",
      "Globex Inc                         2018 - 2020",
      "Initech                            2015 - 2018",
      "EDUCATION",
      "State University                   2011 - 2015",
    ].join("\n");
    expect(run(text)).toEqual([]);
  });

  it("does not fire on an interior gap alone, with no heading mid-line", () => {
    const text = [
      "Built the billing service          owned on-call rotation",
      "Migrated the data warehouse        cut query cost by half",
      "Led the platform guild             ran the design review",
    ].join("\n");
    expect(run(text)).toEqual([]);
  });

  it("does not fire on a heading mid-line alone, without enough interior gaps", () => {
    // Two qualifying gapped lines — one short of MIN_INTERIOR_GAPS (3) — so
    // this genuinely probes the threshold. A fixture with zero interior gaps
    // would pass even if the threshold were 1.
    const text = [
      "Built the billing service          owned on-call rotation",
      "Migrated the data warehouse        cut query cost by half",
      "Acme Corp                          EDUCATION",
    ].join("\n");
    expect(run(text)).toEqual([]);
  });

  it("returns nothing for empty or single-line text", () => {
    expect(run("")).toEqual([]);
    expect(run("Just one line")).toEqual([]);
  });

  // A heading IS stranded here, so headingsMidLine is 1 and the empty result
  // can only come from the date filter removing the three gapped lines. If
  // isDateRange stopped working, this test fires and fails.
  it("filters right-aligned dates even when a heading is stranded mid-line", () => {
    const text = [
      "Jane Doe                           SKILLS",
      "Acme Corp                          2020 - 2023",
      "Globex Inc                         2018 - 2020",
      "Initech                            2015 - 2018",
    ].join("\n");
    expect(run(text)).toEqual([]);
  });

  it("filters date-first lines, where the date sits left of the gap", () => {
    const text = [
      "Jane Doe                           SKILLS",
      "Jan 2020 - Dec 2023                Senior Engineer, Acme Corp",
      "Jan 2018 - Dec 2019                Engineer, Globex Inc",
      "Jan 2015 - Dec 2017                Engineer, Initech",
    ].join("\n");
    expect(run(text)).toEqual([]);
  });

  // Same fixture shape as the other date tests, so the empty result can only
  // come from the filter recognizing these three dash/word forms.
  it("filters minus-sign, hyphen-punctuation, and 'to' date ranges", () => {
    const text = [
      "Jane Doe                           SKILLS",
      "Acme Corp                          2020 − 2023",
      "Globex Inc                         2018 ‐ 2020",
      "Initech                            2015 to 2018",
    ].join("\n");
    expect(run(text)).toEqual([]);
  });

  it("does not fire on a labelled skills block in a one-column résumé", () => {
    const text = [
      "TECHNICAL SKILLS",
      "Languages:        Python, Go, TypeScript",
      "Technologies:     Docker, Kubernetes, Terraform",
      "Databases:        PostgreSQL, Redis, DynamoDB",
      "Tools:            Git, Jenkins, Datadog",
      "EXPERIENCE",
      "Acme Corp                          San Francisco, CA",
    ].join("\n");
    expect(detectMergedColumns(text, matchHeading, new Set(["skills", "experience"]))).toEqual([]);
  });
});

describe("detectMergedColumns — a genuine merge", () => {
  // Four gapped body lines and two stranded headings. Three of the body lines
  // must survive the date filter, because MIN_INTERIOR_GAPS is 3 — a fixture
  // with only two would not fire even against a correct implementation.
  const merged = [
    "Jane Doe                           SKILLS",
    "Senior Engineer                    TypeScript, Go, Kubernetes",
    "jane@example.com                   Terraform, PostgreSQL",
    "Portfolio: janedoe.dev             AWS, Docker",
    "EXPERIENCE                         EDUCATION",
  ].join("\n");

  it("fires when both signals are present", () => {
    expect(run(merged).length).toBeGreaterThan(0);
  });

  it("quotes the offending lines verbatim and numbers them 1-based", () => {
    const ev = run(merged);
    const first = ev[0];
    expect(merged.split("\n")[first.line_number - 1]).toBe(first.line);
  });

  it("labels a line carrying a heading fragment as heading_mid_line", () => {
    const ev = run(merged);
    expect(ev.some((e) => e.signal === "heading_mid_line")).toBe(true);
    expect(ev.some((e) => e.signal === "interior_gap")).toBe(true);
  });

  it("reports a heading found on either side of the gap", () => {
    const leftSide = [
      "SKILLS                             Jane Doe",
      "TypeScript, Go                     Senior Engineer",
      "Terraform, PostgreSQL              jane@example.com",
      "AWS, Docker                        Portfolio: janedoe.dev",
    ].join("\n");
    expect(run(leftSide).some((e) => e.signal === "heading_mid_line")).toBe(true);
  });
});
