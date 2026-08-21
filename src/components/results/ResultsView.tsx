"use client";

import { useRef } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GateCells } from "./GateCells";
import { FindingRow } from "./FindingRow";
import { Section } from "./Section";
import { ErrorReportPanel } from "./ErrorReportPanel";
import { FormattingAuditPanel } from "./FormattingAuditPanel";
import { SkillsGapPanel } from "./SkillsGapPanel";
import { SummaryPanel } from "./SummaryPanel";
import { ExportButton } from "./ExportButton";
import type { AnalysisResult } from "@/types/analysis";

interface ResultsViewProps {
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

export function ResultsView({ result, onReset }: ResultsViewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const funnel = result.funnel;

  const blocking = funnel?.knockout.checks.filter((c) => c.required && c.verdict === "fail") ?? [];
  const checkYourself =
    funnel?.knockout.checks.filter((c) => c.required && c.verdict === "unverifiable") ?? [];
  const misses = funnel?.retrieve.misses ?? [];
  // A blocked or invisible résumé leads with that, not with twelve writing nits.
  const hasUrgent = blocking.length > 0 || checkYourself.length > 0 || misses.length > 0;

  const verdict = result.summary.verdict;

  // Section instances persist across a second analysis unless keyed off the
  // result, so a stale open/closed state would survive a fresh run — key by
  // the per-result timestamp to force remount.
  const sectionKey = result.metadata.analyzed_at;

  return (
    <div ref={printRef} className="space-y-1">
      <div className="flex items-start justify-between gap-4 pb-4">
        <div>
          <div className={cn("font-mono text-3xl font-semibold tracking-tight", VERDICT_CLASS[verdict])}>
            {VERDICT_LABEL[verdict] ?? "Moderate"}
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

      {funnel && (
        <div className="pb-2">
          <GateCells funnel={funnel} />
        </div>
      )}

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

      {blocking.length > 0 && (
        <Section key={`${sectionKey}-blocking`} title="Blocking" count={blocking.length}>
          {blocking.map((c, i) => (
            <FindingRow key={i} tag="KO" tone="fail" meta={c.type.replace(/_/g, " ")}>
              {c.detail}
            </FindingRow>
          ))}
        </Section>
      )}

      {checkYourself.length > 0 && (
        <Section key={`${sectionKey}-check-yourself`} title="Check yourself" count={checkYourself.length}>
          {checkYourself.map((c, i) => (
            <FindingRow key={i} tag="ASK" tone="unknown" meta={c.type.replace(/_/g, " ")}>
              {c.detail}
            </FindingRow>
          ))}
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            A resume never states work authorization or location, and ResCheck never sees the
            application form. Those are yours to confirm — not a pass and not a failure.
          </p>
        </Section>
      )}

      {misses.length > 0 && funnel && (
        <Section key={`${sectionKey}-not-found`} title="Not found by search" count={misses.length}>
          {misses.map((m, i) => (
            <FindingRow key={i} tag="SRCH" tone="warn">
              No recruiter search for <span className="font-mono">{m}</span> would surface you.
            </FindingRow>
          ))}
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Your résumé surfaces for {funnel.retrieve.surfaced} of the {funnel.retrieve.total}{" "}
            {funnel.retrieve.total === 1 ? "search" : "searches"} a recruiter would plausibly run.
          </p>
        </Section>
      )}

      {result.errors.length > 0 && (
        <Section key={`${sectionKey}-writing`} title="Writing" count={result.errors.length} defaultOpen={!hasUrgent}>
          <ErrorReportPanel errors={result.errors} />
        </Section>
      )}

      {funnel && funnel.signals.length > 0 && (
        <Section key={`${sectionKey}-how-you-sort`} title="How you sort" count={funnel.signals.length} defaultOpen={!hasUrgent}>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Nothing here is a rejection, and these are deliberately not combined into a
            score — ResCheck has no other applicants to rank you against.
          </p>
          {funnel.signals.map((s) => (
            <div key={s.key} className="py-2.5 border-b border-border/60 last:border-b-0">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm">{s.label}</span>
                <span className="font-mono text-sm tabular-nums shrink-0">{s.value}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{s.detail}</p>
            </div>
          ))}
        </Section>
      )}

      {result.formatting_audit && (
        <Section key={`${sectionKey}-ats`} title="What the ATS sees" defaultOpen={false}>
          <FormattingAuditPanel
            audit={result.formatting_audit}
            atsExtraction={result.ats_extraction}
          />
        </Section>
      )}

      <Section key={`${sectionKey}-skills`} title="Skills" defaultOpen={false}>
        <SkillsGapPanel skillsGap={result.skills_gap} />
      </Section>

      <Section key={`${sectionKey}-summary`} title="Summary" defaultOpen={false}>
        <SummaryPanel summary={result.summary} metadata={result.metadata} />
      </Section>
    </div>
  );
}
