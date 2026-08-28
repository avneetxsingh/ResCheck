// Dated work-history extraction. The AI reports role headers and raw date
// strings; every date calculation happens here so the numbers are reproducible.
import type { StructuredResume } from "./ats-extract";

export interface ParsedDate {
  year: number | null; // null only when precision is "present"
  month: number | null; // 1-12; null only when precision is "present"
  precision: "month" | "year" | "present";
}

export interface DateRange {
  start: ParsedDate | null;
  end: ParsedDate | null;
}

export interface WorkHistoryMetrics {
  total_experience_months: number;
  last_used_months_ago: number | null;
  avg_tenure_months: number | null;
  gap_months: number[];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function parseResumeDate(raw: string): ParsedDate | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (/^(present|current|now|to date|ongoing)$/.test(t)) {
    return { year: null, month: null, precision: "present" };
  }

  const named = t.match(/^([a-z]{3,9})\.?\s+(\d{4})$/);
  if (named) {
    const month = MONTHS[named[1].slice(0, 3)];
    if (month) return { year: Number(named[2]), month, precision: "month" };
    return null;
  }

  const numeric = t.match(/^(\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const month = Number(numeric[1]);
    if (month >= 1 && month <= 12) return { year: Number(numeric[2]), month, precision: "month" };
    return null;
  }

  // Year-only is real but imprecise: anchor to January and mark it, so callers
  // can refuse to treat it as verified recency.
  const yearOnly = t.match(/^(\d{4})$/);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    if (year >= 1950 && year <= 2100) return { year, month: 1, precision: "year" };
  }
  return null;
}

function toAbsoluteMonths(d: ParsedDate, now: Date): number {
  if (d.precision === "present") return now.getUTCFullYear() * 12 + (now.getUTCMonth() + 1);
  return (d.year ?? 0) * 12 + (d.month ?? 1);
}

export function computeWorkHistoryMetrics(ranges: DateRange[], now: Date = new Date()): WorkHistoryMetrics {
  const nowAbs = now.getUTCFullYear() * 12 + (now.getUTCMonth() + 1);

  const spans = ranges
    .filter((r): r is { start: ParsedDate; end: ParsedDate } => r.start !== null && r.end !== null)
    .map((r) => ({ from: toAbsoluteMonths(r.start, now), to: toAbsoluteMonths(r.end, now) }))
    .filter((s) => s.to >= s.from)
    .sort((a, b) => a.from - b.from);

  if (spans.length === 0) {
    return { total_experience_months: 0, last_used_months_ago: null, avg_tenure_months: null, gap_months: [] };
  }

  // Concurrent or overlapping roles must not double-count, so merge before summing.
  const merged: { from: number; to: number }[] = [];
  const gaps: number[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.from <= last.to) {
      last.to = Math.max(last.to, span.to);
      continue;
    }
    if (last) {
      // Endpoints are inclusive, so adjacent months (Dec then Jan) are a gap of 0.
      const gap = span.from - last.to - 1;
      if (gap > 6) gaps.push(gap);
    }
    merged.push({ ...span });
  }

  // Inclusive of both endpoint months: Jan 2020 - Dec 2020 is 12 months, not 11.
  const total = merged.reduce((sum, s) => sum + (s.to - s.from + 1), 0);
  const latestEnd = Math.max(...merged.map((s) => s.to));

  return {
    total_experience_months: total,
    last_used_months_ago: Math.max(0, nowAbs - latestEnd),
    avg_tenure_months: Math.round(
      spans.reduce((sum, s) => sum + (s.to - s.from + 1), 0) / spans.length
    ),
    gap_months: gaps,
  };
}

// Raw role record as reported by AI-2. header_line is a verbatim copy of the
// resume line that starts the role and is the only anchor used for segmenting.
export interface RawRole {
  header_line: string;
  employer: string;
  title: string;
  start: string;
  end: string;
}

export interface RoleBlock {
  employer: string;
  title: string;
  range: DateRange;
  text: string; // "" when the anchor could not be located
  anchored: boolean;
}

const BULLET_LINE = /^[•\-*\u2013\u2014\u25aa\u00b7]/;

// The model retypes the header, so spacing rarely survives byte-identical.
function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function segmentRoles(structured: StructuredResume, raw: RawRole[]): RoleBlock[] {
  const experience = structured.sections.filter((s) => s.name === "experience" || s.name === "projects");
  // Section starts are hard boundaries: without them the last experience role
  // absorbed the projects section and dated that work to itself.
  const lines: string[] = [];
  const sectionStarts: number[] = [];
  for (const section of experience) {
    sectionStarts.push(lines.length);
    lines.push(...section.lines);
  }
  const collapsedLines = lines.map(collapse);

  const findAllMatchingIndices = (headerLine: string): number[] => {
    const needle = collapse(headerLine);
    if (!needle) return [];

    const matches: number[] = [];
    // Exact matches first
    for (let i = 0; i < collapsedLines.length; i++) {
      if (collapsedLines[i] === needle) {
        matches.push(i);
      }
    }
    if (matches.length > 0) return matches;

    // Fallback to containment: the model sometimes trims a trailing location
    // or date fragment off the line it copies. One-directional only, and long
    // enough to be distinctive — a bare company name must not satisfy a full
    // header, which previously let one role claim another's line.
    if (needle.length < 8) return matches;

    // A role header never starts with a bullet marker, so excluding those stops
    // a mid-role bullet from being claimed as a header.
    const candidates: number[] = [];
    for (let i = 0; i < collapsedLines.length; i++) {
      if (BULLET_LINE.test(lines[i].trim())) continue;
      if (collapsedLines[i].includes(needle)) candidates.push(i);
    }

    // Prefer lines the needle STARTS: "software engineer, acme" begins its own
    // header but sits mid-line inside "senior software engineer, acme", so
    // taking the first containment match gave a promotion-pattern resume the
    // wrong role — and with it the wrong dates, recency, and strength.
    const prefixed = candidates.filter((i) => collapsedLines[i].startsWith(needle));
    return prefixed.length > 0 ? prefixed : candidates;
  };

  // Process roles in order, claiming indices uniquely. When a role's needle
  // matches a line already claimed, continue searching for the next unclaimed match.
  const claimedIndices = new Set<number>();
  const located: Array<{ raw: RawRole; index: number }> = [];

  for (const r of raw) {
    const allMatches = findAllMatchingIndices(r.header_line);
    let index = -1;
    for (const m of allMatches) {
      if (!claimedIndices.has(m)) {
        index = m;
        break;
      }
    }
    if (index !== -1) {
      claimedIndices.add(index);
    }
    located.push({ raw: r, index });
  }

  // Build sorted list of distinct claimed indices for boundary detection
  const anchoredIndices = Array.from(claimedIndices).sort((a, b) => a - b);

  return located.map(({ raw: r, index }) => {
    const range: DateRange = { start: parseResumeDate(r.start), end: parseResumeDate(r.end) };
    if (index === -1) {
      return { employer: r.employer, title: r.title, range, text: "", anchored: false };
    }
    const nextAnchor = anchoredIndices.find((i) => i > index);
    const nextSection = sectionStarts.find((i) => i > index);
    const end = Math.min(nextAnchor ?? lines.length, nextSection ?? lines.length);
    const text = lines.slice(index, end).join("\n");
    return { employer: r.employer, title: r.title, range, text, anchored: true };
  });
}

// Gaps are reported at the same bar computeWorkHistoryMetrics uses. The two
// calculations are deliberately kept in lockstep — see the agreement test in
// work-history.test.ts.
export const GAP_THRESHOLD_MONTHS = 6;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Never fabricates precision the parse did not have: a year-precision date
// renders as the bare year rather than guessing January.
export function formatParsedDate(d: ParsedDate): string {
  if (d.precision === "present") return "present";
  if (d.year === null) return "an undated point";
  if (d.precision === "year" || d.month === null) return String(d.year);
  return `${MONTH_NAMES[d.month - 1]} ${d.year}`;
}

// The employer is what a candidate recognises; the title is the fallback when
// the model reported no employer. Never returns "" — an empty name would
// produce "between  and Globex".
export function roleLabel(role: RoleBlock): string {
  return role.employer.trim() || role.title || "an unnamed role";
}

export interface EmploymentGap {
  months: number;
  /** Title of the role that ended when the gap opened. */
  role_before: string;
  /** Title of the role that began when the gap closed. */
  role_after: string;
  ended_at: ParsedDate;
  resumed_at: ParsedDate;
}

interface LabelledSpan {
  from: number;
  to: number;
  label: string;
  startDate: ParsedDate;
  endDate: ParsedDate;
}

type DatedRole = RoleBlock & { range: { start: ParsedDate; end: ParsedDate } };

// Deliberately NOT folded into computeWorkHistoryMetrics: that function is also
// called on single ranges by keyword-match.ts, where a role label means nothing.
export function computeEmploymentGaps(roles: RoleBlock[], now: Date = new Date()): EmploymentGap[] {
  const spans: LabelledSpan[] = roles
    .filter((r): r is DatedRole => r.range.start !== null && r.range.end !== null)
    .map((r) => ({
      from: toAbsoluteMonths(r.range.start, now),
      to: toAbsoluteMonths(r.range.end, now),
      label: roleLabel(r),
      startDate: r.range.start,
      endDate: r.range.end,
    }))
    .filter((s) => s.to >= s.from)
    .sort((a, b) => a.from - b.from);

  if (spans.length === 0) return [];

  const gaps: EmploymentGap[] = [];
  let current = { to: spans[0].to, label: spans[0].label, endDate: spans[0].endDate };

  for (let i = 1; i < spans.length; i += 1) {
    const span = spans[i];
    if (span.from <= current.to) {
      // Concurrent or overlapping roles are one continuous block; it ends
      // whenever the longest-running of them ends.
      if (span.to > current.to) {
        current = { to: span.to, label: span.label, endDate: span.endDate };
      }
      continue;
    }
    // Endpoints are inclusive, so adjacent months (Dec then Jan) are a gap of 0.
    const months = span.from - current.to - 1;
    if (months > GAP_THRESHOLD_MONTHS) {
      gaps.push({
        months,
        role_before: current.label,
        role_after: span.label,
        ended_at: current.endDate,
        resumed_at: span.startDate,
      });
    }
    current = { to: span.to, label: span.label, endDate: span.endDate };
  }

  return gaps;
}
