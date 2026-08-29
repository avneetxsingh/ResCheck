// Detects SYMPTOMS of a two-column layout flattened into one text stream. We
// never see the PDF's layout — only the text pdf-parse produced — so this
// reports evidence lines and never claims the document "has columns".
//
// Both signals must fire before anything is returned. The detector is tuned to
// under-report: a miss costs a user nothing, whereas a false positive tells
// someone their résumé is broken when it is not, and moves their parse gate.
import { parseResumeDate } from "./work-history";
import type { ColumnEvidence } from "@/types/analysis";

/**
 * Injected rather than imported: ats-extract.ts imports THIS module, so
 * importing its matchSectionHeading back would be a cycle.
 */
export type SectionMatcher = (line: string) => string | null;

const MIN_INTERIOR_GAPS = 3;

// Splits a line at its first run of 3+ interior spaces. Returns null when the
// line has no such run — the gap must have text on both sides to be interior.
function splitOnGap(line: string): [string, string] | null {
  const m = line.match(/^(.*?\S) {3,}(\S.*)$/);
  return m ? [m[1].trim(), m[2].trim()] : null;
}

// A right-aligned date is the commonest wide gap on an ordinary one-column
// résumé. Counting it as column evidence would fire this detector on nearly
// every well-formatted document.
function isDateRange(fragment: string): boolean {
  const parts = fragment
    .replace(/[–—]/g, "-")
    .split(/\s*-\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0 || parts.length > 2) return false;
  return parts.every((p) => parseResumeDate(p) !== null);
}

export function detectMergedColumns(
  text: string,
  matchHeading: SectionMatcher
): ColumnEvidence[] {
  const lines = text.split(/\r?\n/);
  const evidence: ColumnEvidence[] = [];
  let interiorGaps = 0;
  let headingsMidLine = 0;

  lines.forEach((line, i) => {
    const split = splitOnGap(line);
    if (!split) return;
    const [left, right] = split;

    // A heading stranded beside other text is the discriminating signal:
    // headings do not land mid-line in single-column text. It happens because
    // matchSectionHeading rejects lines over 40 chars, so a merge silently
    // reclassifies the heading as body text.
    if (matchHeading(left) !== null || matchHeading(right) !== null) {
      headingsMidLine += 1;
      evidence.push({ line, line_number: i + 1, signal: "heading_mid_line" });
      return;
    }

    if (isDateRange(right)) return;
    interiorGaps += 1;
    evidence.push({ line, line_number: i + 1, signal: "interior_gap" });
  });

  if (interiorGaps < MIN_INTERIOR_GAPS || headingsMidLine === 0) return [];
  return evidence;
}
