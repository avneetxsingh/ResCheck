"use client";

import { ScoreRing } from "./ScoreRing";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { Scorecard, ExecutiveSummary } from "@/types/analysis";
import { cn } from "@/lib/utils";

interface ScorecardPanelProps {
  scorecard: Scorecard;
  verdict: ExecutiveSummary["verdict"];
}

const VERDICT_CONFIG = {
  strong: { label: "Strong Candidate", className: "bg-green-500/10 text-green-600 border-green-500/30" },
  moderate: { label: "Good Candidate", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  needs_work: { label: "Needs Improvement", className: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  critical: { label: "Critical Issues", className: "bg-red-500/10 text-red-600 border-red-500/30" },
};

const METRICS = [
  "skills_match_score",
  "grammar_score",
  "formatting_score",
  "impact_score",
  "keyword_density_score",
] as const;

function scoreColorClass(score: number) {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}

function progressColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export function ScorecardPanel({ scorecard, verdict }: ScorecardPanelProps) {
  const verdictConfig = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG["moderate"];

  return (
    <div className="space-y-6">
      {/* Overall score */}
      <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-xl border bg-card">
        <ScoreRing
          score={scorecard.overall_ats_score.score}
          size="lg"
          label="ATS Score"
        />
        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div className={cn("inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border", verdictConfig.className)}>
            {verdictConfig.label}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {scorecard.overall_ats_score.rationale}
          </p>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
            Tip: {scorecard.overall_ats_score.improvement_tip}
          </p>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {METRICS.map((key) => {
          const metric = scorecard[key];
          if (!metric) return null;
          return (
            <Card key={key} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{metric.label}</span>
                  <Tooltip>
                    <TooltipTrigger className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="w-3.5 h-3.5" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-sm">
                      <p className="font-medium mb-1">{metric.rationale}</p>
                      <p className="text-muted-foreground">Tip: {metric.improvement_tip}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex items-center gap-3">
                  <span className={cn("text-2xl font-bold tabular-nums", scoreColorClass(metric.score))}>
                    {metric.score}
                  </span>
                  <div className="flex-1">
                    <Progress
                      value={metric.score}
                      className="h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
