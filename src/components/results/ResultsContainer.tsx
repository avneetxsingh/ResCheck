"use client";

import { useRef } from "react";
import { RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScorecardPanel } from "./ScorecardPanel";
import { ErrorReportPanel } from "./ErrorReportPanel";
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
          <p className="text-sm text-muted-foreground">
            {result.metadata.total_errors_found} issues · {result.skills_gap.overall_match_percentage}% skill match
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
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="errors">
            Errors
            {result.errors.length > 0 && (
              <span className="ml-1.5 text-xs bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 rounded-full">
                {result.errors.length}
              </span>
            )}
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
