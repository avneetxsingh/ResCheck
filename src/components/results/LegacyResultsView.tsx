"use client";

import { useRef } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Section } from "./Section";
import { ErrorReportPanel } from "./ErrorReportPanel";
import { FormattingAuditPanel } from "./FormattingAuditPanel";
import { SkillsGapPanel } from "./SkillsGapPanel";
import { SummaryPanel } from "./SummaryPanel";
import { ExportButton } from "./ExportButton";
import type { AnalysisResult, ScorecardMetric } from "@/types/analysis";

interface LegacyResultsViewProps {
  result: AnalysisResult;
  onReset: () => void;
}

const VERDICT_CLASS: Record<string, string> = {
  strong: "text-state-pass",
  moderate: "text-state-warn",
  needs_work: "text-state-warn",
  critical: "text-state-fail",
};

const VERDICT_LABEL: Record<string, string> = {
  strong: "Strong",
  moderate: "Moderate",
  needs_work: "Needs work",
  critical: "Critical",
};

// Entries saved before the funnel have no gates. They render with what they
// actually carry — never with fabricated gates or a fabricated score.
export function LegacyResultsView({ result, onReset }: LegacyResultsViewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const verdict = result.summary.verdict;
  const legacyScore = result.scorecard.overall_ats_score?.score;

  const writingMetrics: ScorecardMetric[] = [
    result.scorecard.impact_score,
    result.scorecard.grammar_score,
    result.scorecard.formatting_score,
  ].filter((m): m is ScorecardMetric => m !== undefined);

  return (
    <div ref={printRef} className="space-y-1">
      <div className="flex items-start justify-between gap-4 pb-4">
        <div>
          <div className="flex items-start gap-3">
            {typeof legacyScore === "number" && (
              <div className="flex flex-col items-start">
                <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight leading-none">
                  {legacyScore}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                  retired ATS score — no longer computed
                </span>
              </div>
            )}
            <span className={cn("font-mono text-lg font-semibold", VERDICT_CLASS[verdict])}>
              {VERDICT_LABEL[verdict] ?? "Moderate"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-prose leading-relaxed">
            {result.summary.headline}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportButton result={result} targetRef={printRef} />
          <Button variant="outline" size="sm" className="gap-2" onClick={onReset}>
            <RotateCcw className="w-3.5 h-3.5" />
            New run
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-2 leading-relaxed">
        This run predates the screening funnel, so it has no gates. Run it again to see
        whether it parses, meets the posting&apos;s stated requirements, and surfaces in a search.
      </p>

      {result.warnings && result.warnings.length > 0 && (
        <ul className="space-y-1 py-3">
          {result.warnings.map((w, i) => (
            <li key={i} className="text-xs text-state-warn flex gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      {writingMetrics.length > 0 && (
        <Section title="Writing quality">
          {writingMetrics.map((m) => (
            <div key={m.label} className="py-2.5 border-b border-border/60 last:border-b-0">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm">{m.label}</span>
                <span className="font-mono text-sm tabular-nums shrink-0">{m.score}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{m.rationale}</p>
            </div>
          ))}
        </Section>
      )}

      {result.errors.length > 0 && (
        <Section title="Writing" count={result.errors.length} defaultOpen={false}>
          <ErrorReportPanel errors={result.errors} />
        </Section>
      )}

      {result.formatting_audit && (
        <Section title="What the ATS sees" defaultOpen={false}>
          <FormattingAuditPanel
            audit={result.formatting_audit}
            atsExtraction={result.ats_extraction}
          />
        </Section>
      )}

      <Section title="Skills" defaultOpen={false}>
        <SkillsGapPanel skillsGap={result.skills_gap} />
      </Section>

      <Section title="Summary" defaultOpen={false}>
        <SummaryPanel summary={result.summary} metadata={result.metadata} />
      </Section>
    </div>
  );
}
