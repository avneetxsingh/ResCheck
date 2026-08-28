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
import { AmbushKitPanel } from "./AmbushKitPanel";
import { SummaryPanel } from "./SummaryPanel";
import { ExportButton } from "./ExportButton";
import { LegacyResultsView } from "./LegacyResultsView";
import type { AnalysisResult } from "@/types/analysis";
import type { PartialAnalysis } from "@/types/api";
import { Reveal } from "@/components/motion/Reveal";
import { PendingPanel } from "./PendingPanel";

interface ResultsViewProps {
  // null while a run is still in flight and only the early gates exist.
  result: AnalysisResult | null;
  // The two gates that are final as soon as AI-1 lands, ~18s before the rest.
  partial: PartialAnalysis | null;
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

export function ResultsView({ result, partial, onReset }: ResultsViewProps) {
  // Hooks must run in the same order on every render, so this stays above the
  // legacy early return — switching between a pre-funnel and a funnel-shaped
  // past run reuses this same mounted component.
  const printRef = useRef<HTMLDivElement>(null);

  // Pre-funnel entries have no gates to rank. They get their own view rather
  // than an empty shell where the gates would be.
  if (result && !result.funnel) {
    return <LegacyResultsView result={result} onReset={onReset} />;
  }

  const funnel = result?.funnel ?? null;
  // Prefer the settled funnel; fall back to the early gates while one is in
  // flight. These never disagree — the partial carries the same computation,
  // just sooner.
  const parse = funnel?.parse ?? partial?.parse ?? null;
  const retrieve = funnel?.retrieve ?? partial?.retrieve ?? null;
  if (!parse || !retrieve) return null;

  // A run that has not settled shows no verdict word. Deriving one from two of
  // three gates would mean printing a judgement that could change seconds
  // later, which is the one thing this app does not do.
  const settled = result !== null && funnel !== null;

  const parseReasons = parse.verdict !== "clean" ? parse.reasons : [];
  const blocking = funnel ? funnel.knockout.checks.filter((c) => c.required && c.verdict === "fail") : [];
  const checkYourself = funnel
    ? funnel.knockout.checks.filter((c) => c.required && c.verdict === "unverifiable")
    : [];
  const misses = retrieve.misses;

  // One panel, not three hairlines: a résumé that will not parse, a stated
  // requirement it fails, and a search that will not surface it all cost the
  // user the same thing. The per-row tag keeps the kinds apart.
  const stoppingCount = parseReasons.length + blocking.length + misses.length;
  // A blocked or invisible résumé leads with that, not with twelve writing nits.
  const hasUrgent = stoppingCount > 0 || checkYourself.length > 0;

  const verdict = result?.summary.verdict;

  // Section instances persist across a second analysis unless keyed off the
  // result, so a stale open/closed state would survive a fresh run — key by
  // the per-result timestamp to force remount.
  const sectionKey = result?.metadata.analyzed_at ?? "pending";

  return (
    <div ref={printRef} className="space-y-6">
      <Reveal>
      <section className="rounded-xl border border-border bg-card px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {settled && verdict ? (
              <>
                <div className={cn("font-mono text-3xl font-semibold tracking-tight", VERDICT_CLASS[verdict])}>
                  {VERDICT_LABEL[verdict] ?? "Moderate"}
                </div>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-prose leading-relaxed">
                  {result?.summary.headline}
                </p>
              </>
            ) : (
              <>
                <div className="font-mono text-3xl font-semibold tracking-tight text-muted-foreground">
                  Screening
                </div>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-prose leading-relaxed">
                  Two gates are in. Still reading your writing — the last check takes
                  the longest.
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {result && <ExportButton result={result} targetRef={printRef} />}
            <Button variant="outline" size="sm" className="gap-2" onClick={onReset}>
              <RotateCcw className="w-3.5 h-3.5" />
              New run
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <GateCells parse={parse} knockout={funnel?.knockout ?? null} retrieve={retrieve} />
        </div>
      </section>
      </Reveal>

      {result?.warnings && result.warnings.length > 0 && (
        <ul className="space-y-1">
          {result.warnings.map((w: string, i: number) => (
            <li key={i} className="text-xs text-state-warn flex gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      {stoppingCount > 0 && (
        <Reveal delay={60}>
        <Panel title="What's stopping you" count={stoppingCount}>
          {parseReasons.map((r, i) => (
            <FindingRow
              key={`parse-${i}`}
              tag="PARSE"
              tone={parse.verdict === "likely_breaks" ? "fail" : "warn"}
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
              Your résumé surfaces for {retrieve.surfaced} of the {retrieve.total}{" "}
              {retrieve.total === 1 ? "search" : "searches"} a recruiter would plausibly run.
            </p>
          )}
        </Panel>
        </Reveal>
      )}

      {checkYourself.length > 0 && (
        <Reveal delay={120}>
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
        </Reveal>
      )}

      <Reveal delay={180} className="space-y-1">
        {!settled && <PendingPanel title="Writing" lines={3} />}

        {settled && (
          <Section
            key={`${sectionKey}-questions`}
            title="Questions this résumé invites"
            count={result?.ambush_kit?.questions.length}
            defaultOpen={!hasUrgent}
          >
            <AmbushKitPanel kit={result?.ambush_kit} />
          </Section>
        )}

        {result && result.errors.length > 0 && (
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

        {result?.formatting_audit && (
          <Section key={`${sectionKey}-ats`} title="What the ATS sees" defaultOpen={false}>
            <FormattingAuditPanel
              audit={result.formatting_audit}
              atsExtraction={result.ats_extraction}
            />
          </Section>
        )}

        {result && (
          <Section key={`${sectionKey}-skills`} title="Skills" defaultOpen={false}>
            <SkillsGapPanel skillsGap={result.skills_gap} />
          </Section>
        )}

        {result && (
          <Section key={`${sectionKey}-summary`} title="Summary" defaultOpen={false}>
            <SummaryPanel summary={result.summary} metadata={result.metadata} />
          </Section>
        )}
      </Reveal>
    </div>
  );
}
