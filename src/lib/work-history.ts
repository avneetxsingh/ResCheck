// Dated work-history extraction. The AI reports role headers and raw date
// strings; every date calculation happens here so the numbers are reproducible.

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
