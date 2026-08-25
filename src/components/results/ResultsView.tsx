"use client";

import { useRef } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GateCells } from "./GateCells";
import { FindingRow } from "./FindingRow";
import { Panel } from "./Panel";
import { Section } from "./Section";
import { ErrorReportPanel } from "./ErrorReportPanel";
import { FormattingAuditPanel } from "./FormattingAuditPanel";
import { SkillsGapPanel } from "./SkillsGapPanel";
import { SummaryPanel } from "./SummaryPanel";
import { ExportButton } from "./ExportButton";
import { LegacyResultsView } from "./LegacyResultsView";
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
  // Hooks must run in the same order on every render, so this stays above the
  // legacy early return — switching between a pre-funnel and a funnel-shaped
  // past run reuses this same mounted component.
  const printRef = useRef<HTMLDivElement>(null);

  // Pre-funnel entries have no gates to rank. They get their own view rather
  // than an empty shell where the gates would be.
  if (!result.funnel) {
    return <LegacyResultsView result={result} onReset={onReset} />;
  }

  const funnel = result.funnel;

  const parseReasons =
    funnel.parse.verdict !== "clean" ? funnel.parse.reasons : [];
  const blocking = funnel.knockout.checks.filter((c) => c.required && c.verdict === "fail");
  const checkYourself = funnel.knockout.checks.filter(
    (c) => c.required && c.verdict === "unverifiable"
  );
  const misses = funnel.retrieve.misses;

  // One panel, not three hairlines: a résumé that will not parse, a stated
  // requirement it fails, and a search that will not surface it all cost the
  // user the same thing. The per-row tag keeps the kinds apart.
  const stoppingCount = parseReasons.length + blocking.length + misses.length;
  // A blocked or invisible résumé leads with that, not with twelve writing nits.
  const hasUrgent = stoppingCount > 0 || checkYourself.length > 0;

  const verdict = result.summary.verdict;

  // Section instances persist across a second analysis unless keyed off the
  // result, so a stale open/closed state would survive a fresh run — key by
  // the per-result timestamp to force remount.
  const sectionKey = result.metadata.analyzed_at;

  return (
    <div ref={printRef} className="space-y-6">
      <section className="rounded-xl border border-border bg-card px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
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

        <div className="mt-5">
          <GateCells funnel={funnel} />
        </div>
      </section>

      {result.warnings && result.warnings.length > 0 && (
        <ul className="space-y-1">
          {result.warnings.map((w, i) => (
            <li key={i} className="text-xs text-state-warn flex gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      {stoppingCount > 0 && (
        <Panel title="What's stopping you" count={stoppingCount}>
          {parseReasons.map((r, i) => (
            <FindingRow
              key={`parse-${i}`}
              tag="PARSE"
              tone={funnel.parse.verdict === "likely_breaks" ? "fail" : "warn"}
            >
              {r}
            </FindingRow>
          ))}
          {blocking.map((c, i) => (
            <FindingRow key={`ko-${i}`} tag="KO" tone="fail" meta={c.type.replace(/_/g, " ")}>
              {c.detail}
            </FindingRow>
          ))}
          {misses.map((m, i) => (
            <FindingRow key={`srch-${i}`} tag="SRCH" tone="warn">
              No recruiter search for <span className="font-mono">{m}</span> would surface you.
            </FindingRow>
          ))}
          {misses.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              Your résumé surfaces for {funnel.retrieve.surfaced} of the {funnel.retrieve.total}{" "}
              {funnel.retrieve.total === 1 ? "search" : "searches"} a recruiter would plausibly run.
            </p>
          )}
        </Panel>
      )}

      {checkYourself.length > 0 && (
        <Panel title="Check yourself" count={checkYourself.length} quiet>
          {checkYourself.map((c, i) => (
            <FindingRow key={i} tag="ASK" tone="unknown" meta={c.type.replace(/_/g, " ")}>
              {c.detail}
            </FindingRow>
          ))}
          {checkYourself.some(
            (c) => c.type === "work_authorization" || c.type === "location"
          ) && (
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              A resume never states work authorization or location, and ResCheck never sees the
              application form. Those are yours to confirm — not a pass and not a failure.
            </p>
          )}
        </Panel>
      )}

      <div className="space-y-1">
        {result.errors.length > 0 && (
          <Section key={`${sectionKey}-writing`} title="Writing" count={result.errors.length} defaultOpen={!hasUrgent}>
            <ErrorReportPanel errors={result.errors} />
          </Section>
        )}

        {funnel.signals.length > 0 && (
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
    </div>
  );
}
