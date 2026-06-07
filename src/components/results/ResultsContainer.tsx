"use client";

import { useRef } from "react";
import { RotateCcw } from "lucide-react";
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

export function ResultsContainer({ result, onReset }: ResultsContainerProps) {
  const printRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={printRef} className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">Analysis Results</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>{result.metadata.total_errors_found} issues</span>
            <span>·</span>
            <span>{result.skills_gap.overall_match_percentage}% skill match</span>
            {result.metadata.jd_quality && (
              <>
                <span>·</span>
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                    result.metadata.jd_quality === "rich"
                      ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
                      : result.metadata.jd_quality === "moderate"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      : "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30"
                  )}
                >
                  JD: {result.metadata.jd_quality}
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

      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="errors">
            Errors
            {result.errors.length > 0 && (
              <span className="ml-1.5 text-xs bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 rounded-full">
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
                <span className="ml-1.5 text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 rounded-full">
                  {count}
                </span>
              ) : null;
            })()}
          </TabsTrigger>
          <TabsTrigger value="skills">Skills Gap</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ScorecardPanel scorecard={result.scorecard} verdict={result.summary.verdict} />
        </TabsContent>

        <TabsContent value="errors" className="mt-6">
          <ErrorReportPanel errors={result.errors} />
        </TabsContent>

        <TabsContent value="formatting" className="mt-6">
          {result.formatting_audit ? (
            <FormattingAuditPanel audit={result.formatting_audit} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">
              Formatting audit not available for this entry — re-analyze to get per-category breakdown.
            </p>
          )}
        </TabsContent>

        <TabsContent value="skills" className="mt-6">
          <SkillsGapPanel skillsGap={result.skills_gap} />
        </TabsContent>

        <TabsContent value="summary" className="mt-6">
          <SummaryPanel summary={result.summary} metadata={result.metadata} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
