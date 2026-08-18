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
      const gap = span.from - last.to;
      if (gap > 6) gaps.push(gap);
    }
    merged.push({ ...span });
  }

  const total = merged.reduce((sum, s) => sum + (s.to - s.from), 0);
  const latestEnd = Math.max(...merged.map((s) => s.to));

  return {
    total_experience_months: total,
    last_used_months_ago: Math.max(0, nowAbs - latestEnd),
    avg_tenure_months: Math.round(spans.reduce((sum, s) => sum + (s.to - s.from), 0) / spans.length),
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

// The model retypes the header, so spacing rarely survives byte-identical.
function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function segmentRoles(structured: StructuredResume, raw: RawRole[]): RoleBlock[] {
  const experience = structured.sections.filter((s) => s.name === "experience" || s.name === "projects");
  const lines = experience.flatMap((s) => s.lines);
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
    // or date fragment off the line it copies.
    for (let i = 0; i < collapsedLines.length; i++) {
      const l = collapsedLines[i];
      if (l.includes(needle) || needle.includes(l)) {
        matches.push(i);
      }
    }
    return matches;
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
    const next = anchoredIndices.find((i) => i > index);
    const text = lines.slice(index, next ?? lines.length).join("\n");
    return { employer: r.employer, title: r.title, range, text, anchored: true };
  });
}
