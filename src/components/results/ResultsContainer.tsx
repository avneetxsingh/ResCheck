"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScorecardPanel } from "./ScorecardPanel";
import { ErrorReportPanel } from "./ErrorReportPanel";
import { FormattingAuditPanel } from "./FormattingAuditPanel";
import { SkillsGapPanel } from "./SkillsGapPanel";
import { SummaryPanel } from "./SummaryPanel";
import { ExportButton } from "./ExportButton";
import type { AnalysisResult } from "@/types/analysis";

interface ResultsContainerProps {
  result: AnalysisResult;
  onReset: () => void;
}

const VERDICT_LABELS = {
  strong: { label: "Strong", className: "text-green-600 dark:text-green-400" },
  moderate: { label: "Moderate", className: "text-amber-600 dark:text-amber-400" },
  needs_work: { label: "Needs work", className: "text-orange-600 dark:text-orange-400" },
  critical: { label: "Critical", className: "text-red-600 dark:text-red-400" },
} as const;

const JD_QUALITY_DOT = {
  rich: "bg-green-500",
  moderate: "bg-amber-500",
  sparse: "bg-orange-500",
} as const;

function scoreColorClass(score: number) {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function ResultsContainer({ result, onReset }: ResultsContainerProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const overall = result.scorecard.overall_ats_score.score;
  const verdict = VERDICT_LABELS[result.summary.verdict] ?? VERDICT_LABELS.moderate;

  return (
    <motion.div
      ref={printRef}
      className="space-y-6"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Score hero strip */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <span className={cn("text-6xl font-light tracking-tight tabular-nums", scoreColorClass(overall))}>
              {overall}
            </span>
            <span className={cn("text-lg font-medium", verdict.className)}>{verdict.label}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2 flex-wrap">
            <span>{result.metadata.total_errors_found} issues</span>
            <span aria-hidden>·</span>
            <span>{result.skills_gap.overall_match_percentage}% skill match</span>
            {result.metadata.jd_quality && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full", JD_QUALITY_DOT[result.metadata.jd_quality])} />
                  JD {result.metadata.jd_quality}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton result={result} targetRef={printRef} />
          <Button variant="outline" size="sm" className="gap-2" onClick={onReset}>
            <RotateCcw className="w-4 h-4" />
            Analyze Another
          </Button>
        </div>
      </div>

      {result.warnings && result.warnings.length > 0 && (
        <ul className="space-y-1">
          {result.warnings.map((w, i) => (
            <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="errors">
            Errors
            {result.errors.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {result.errors.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="formatting">
            Formatting
            {result.formatting_audit && !result.formatting_audit.is_clean && (() => {
              const auditKeys = ["whitespace_issues", "bold_inconsistencies", "bullet_inconsistencies", "date_format_issues", "capitalization_issues", "other_inconsistencies"] as const;
              const count = auditKeys.reduce(
                (s, k) => s + (result.formatting_audit?.[k]?.length ?? 0),
                0
              );
              return count > 0 ? (
                <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{count}</span>
              ) : null;
            })()}
          </TabsTrigger>
          <TabsTrigger value="skills">Skills Gap</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
          <ScorecardPanel scorecard={result.scorecard} />
        </TabsContent>

        <TabsContent value="errors" className="mt-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
          <ErrorReportPanel errors={result.errors} />
        </TabsContent>

        <TabsContent value="formatting" className="mt-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
          {result.formatting_audit ? (
            <FormattingAuditPanel audit={result.formatting_audit} atsExtraction={result.ats_extraction} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">
              Formatting audit not available for this entry — re-analyze to get per-category breakdown.
            </p>
          )}
        </TabsContent>

        <TabsContent value="skills" className="mt-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
          <SkillsGapPanel skillsGap={result.skills_gap} />
        </TabsContent>

        <TabsContent value="summary" className="mt-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
          <SummaryPanel summary={result.summary} metadata={result.metadata} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
