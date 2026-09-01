// Deterministic formatting audit. Every quoted string comes from the resume
// text itself — this module cannot hallucinate.
import type { FormattingAudit } from "@/types/analysis";
import type { StructuredResume, ResumeSectionBlock } from "./ats-extract";

const BULLET_CHARS = ["•", "-", "*", "–", "▪", "·"];

function bulletChar(line: string): string | null {
  const t = line.trimStart();
  for (const c of BULLET_CHARS) {
    if (t.startsWith(c + " ")) return c;
  }
  return null;
}

function clip(s: string, max = 70): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

function sectionLabel(block: ResumeSectionBlock): string {
  return block.heading !== "" ? block.heading : block.name[0].toUpperCase() + block.name.slice(1);
}

// Matches URLs, bare domains and email addresses so their lowercase spelling is
// never read as a casing mistake.
const URLISH_RE =
  /(?:https?:\/\/|www\.)\S+|\S+@\S+|\b[A-Za-z0-9-]+\.(?:com|net|org|io|dev|me|co|ai|app|xyz)\b\S*/gi;

// Safe list only — words that are never legitimately lowercase mid-resume.
const PROPER_NOUNS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  github: "GitHub",
  linkedin: "LinkedIn",
  sql: "SQL",
  aws: "AWS",
  html: "HTML",
  css: "CSS",
  mongodb: "MongoDB",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  graphql: "GraphQL",
  kubernetes: "Kubernetes",
  python: "Python",
};

const MONTH_LONG =
  /\b(January|February|March|April|June|July|August|September|October|November|December)\s+\d{4}\b/;
const MONTH_SHORT = /\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{4}\b/;
const NUMERIC_DATE = /\b(0?[1-9]|1[0-2])\/\d{4}\b/;
const ISO_DATE = /\b\d{4}-(0?[1-9]|1[0-2])\b/;

export function runFormattingAudit(structured: StructuredResume): FormattingAudit {
  const whitespace_issues: string[] = [];
  const bullet_inconsistencies: string[] = [];
  const date_format_issues: string[] = [];
  const capitalization_issues: string[] = [];
  const other_inconsistencies: string[] = [];

  // Date style consistency is resume-wide: collect first example per style.
  const dateStyles = new Map<string, string>(); // style name -> verbatim example

  for (const block of structured.sections) {
    const label = sectionLabel(block);
    const bulletsSeen = new Map<string, string>(); // char -> first line using it
    let periodEnd: string | null = null;
    let noPeriodEnd: string | null = null;
    let bulletCount = 0;

    for (const line of block.lines) {
      // Whitespace: double spaces — quote the full surrounding words
      const dbl = line.match(/\S+ {2,}\S+/);
      if (dbl) whitespace_issues.push(`[${label}] > double space: '${clip(dbl[0], 50)}'`);

      // Whitespace: comma with no following space (letters only, so "1,000" passes)
      const comma = line.match(/[A-Za-z]+,[A-Za-z]+/);
      if (comma) whitespace_issues.push(`[${label}] > missing space after comma: '${clip(comma[0], 50)}'`);

      // Bullets
      const bc = bulletChar(line);
      if (bc) {
        bulletCount++;
        if (!bulletsSeen.has(bc)) bulletsSeen.set(bc, line);
        if (/[.!?]$/.test(line.trim())) periodEnd = periodEnd ?? line;
        else if (/[A-Za-z0-9)]$/.test(line.trim())) noPeriodEnd = noPeriodEnd ?? line;
      }

      // Dates — order matters: long month first, then short (May is in neither: ambiguous)
      for (const [style, re] of [
        ["long month", MONTH_LONG],
        ["short month", MONTH_SHORT],
        ["MM/YYYY", NUMERIC_DATE],
        ["YYYY-MM", ISO_DATE],
      ] as const) {
        const m = line.match(re);
        if (m && !dateStyles.has(style)) dateStyles.set(style, m[0]);
      }

      // Proper nouns — blank out URLs, domains and handles first. A profile URL
      // is correctly lowercase, so "github.com/jane" is not a casing defect;
      // stripping the token rather than skipping the whole line keeps a genuine
      // lowercase noun visible on a line that also carries a link.
      {
        const prose = line.replace(URLISH_RE, " ");
        for (const [lower, proper] of Object.entries(PROPER_NOUNS)) {
          if (new RegExp(`(^|[^A-Za-z])${lower}([^A-Za-z]|$)`).test(prose)) {
            capitalization_issues.push(
              `[${label}] > lowercase proper noun: '${lower}' should be '${proper}'`
            );
          }
        }
      }

      // Garbled characters
      if (line.includes("�")) {
        other_inconsistencies.push(`[${label}] > garbled characters: '${clip(line, 50)}'`);
      }
    }

    if (bulletsSeen.size > 1) {
      const [[c1, l1], [c2, l2]] = [...bulletsSeen.entries()];
      bullet_inconsistencies.push(
        `[${label}] > mixed bullet characters ('${c1}' vs '${c2}'): '${clip(l1, 40)}' vs '${clip(l2, 40)}'`
      );
    }
    if (bulletCount >= 3 && periodEnd && noPeriodEnd) {
      bullet_inconsistencies.push(
        `[${label}] > mixed period endings: '${clip(periodEnd, 40)}' ends with a period but '${clip(noPeriodEnd, 40)}' does not`
      );
    }
  }

  if (dateStyles.size >= 2) {
    const entries = [...dateStyles.entries()];
    const pairs = entries.map(([style, ex]) => `${style} '${ex}'`).join(" vs ");
    date_format_issues.push(`[Dates] > mixed date formats: ${pairs}`);
  }

  // Heading casing consistency (resume-wide)
  const headings = structured.sections.map((s) => s.heading).filter((h) => h !== "");
  const allCaps = headings.filter((h) => h === h.toUpperCase() && /[A-Z]/.test(h));
  const notCaps = headings.filter((h) => h !== h.toUpperCase());
  if (allCaps.length > 0 && notCaps.length > 0) {
    capitalization_issues.push(
      `[Headings] > mixed heading casing: '${allCaps[0]}' is ALL CAPS but '${notCaps[0]}' is not`
    );
  }

  const audit: FormattingAudit = {
    whitespace_issues,
    bold_inconsistencies: [], // bold is invisible in extracted plain text — never reported by code
    bullet_inconsistencies,
    date_format_issues,
    capitalization_issues,
    other_inconsistencies,
    is_clean: false,
  };
  audit.is_clean =
    whitespace_issues.length === 0 &&
    bullet_inconsistencies.length === 0 &&
    date_format_issues.length === 0 &&
    capitalization_issues.length === 0 &&
    other_inconsistencies.length === 0;
  return audit;
}
