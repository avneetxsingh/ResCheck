"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { Scorecard } from "@/types/analysis";
import { cn } from "@/lib/utils";

interface ScorecardPanelProps {
  scorecard: Scorecard;
}

const METRICS = [
  "skills_match_score",
  "grammar_score",
  "formatting_score",
  "impact_score",
  "keyword_density_score",
] as const;

function scoreColorClass(score: number) {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function barColorClass(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export function ScorecardPanel({ scorecard }: ScorecardPanelProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {scorecard.overall_ats_score.rationale}
        </p>
        <p className="text-sm font-medium text-primary">
          Tip: {scorecard.overall_ats_score.improvement_tip}
        </p>
      </div>

      <div className="rounded-xl border border-border/50 divide-y divide-border/50 overflow-hidden">
        {METRICS.map((key) => {
          const metric = scorecard[key];
          if (!metric) return null;
          return (
            <div key={key} className="flex items-center gap-4 px-4 py-3.5">
              <div className="flex items-center gap-1.5 w-44 shrink-0">
                <span className="text-sm font-medium truncate">{metric.label}</span>
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
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full", barColorClass(metric.score))}
                  style={{ width: `${Math.min(100, Math.max(0, metric.score))}%` }}
                />
              </div>
              <span className={cn("text-lg font-light tabular-nums w-10 text-right", scoreColorClass(metric.score))}>
                {metric.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
