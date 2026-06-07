"use client";

import { TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExecutiveSummary, AnalysisResult } from "@/types/analysis";
import { cn } from "@/lib/utils";

interface SummaryPanelProps {
  summary: ExecutiveSummary;
  metadata: AnalysisResult["metadata"];
}

const VERDICT_BANNER = {
  strong: { bg: "bg-green-500/10 border-green-500/30", text: "text-green-700 dark:text-green-400", icon: "✓" },
  moderate: { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-700 dark:text-amber-400", icon: "~" },
  needs_work: { bg: "bg-orange-500/10 border-orange-500/30", text: "text-orange-700 dark:text-orange-400", icon: "!" },
  critical: { bg: "bg-red-500/10 border-red-500/30", text: "text-red-700 dark:text-red-400", icon: "✕" },
};

export function SummaryPanel({ summary, metadata }: SummaryPanelProps) {
  const banner = VERDICT_BANNER[summary.verdict] ?? VERDICT_BANNER["moderate"];

  return (
    <div className="space-y-4">
      {/* Verdict banner */}
      <div className={cn("rounded-xl border p-4 flex items-start gap-3", banner.bg)}>
        <span className={cn("text-2xl font-bold leading-none mt-0.5", banner.text)}>
          {banner.icon}
        </span>
        <div>
          <p className={cn("font-semibold text-base", banner.text)}>{summary.headline}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {metadata.total_errors_found} issues found across {metadata.resume_word_count} words
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Top Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(summary.top_strengths ?? []).slice(0, 3).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Improvements */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Top Improvements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(summary.top_improvements ?? []).slice(0, 3).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Tailoring advice */}
      <Card className="border-indigo-500/30 bg-indigo-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-indigo-500" />
            Tailoring Advice for This Role
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{summary.tailoring_advice}</p>
        </CardContent>
      </Card>

      {/* Metadata */}
      <p className="text-xs text-muted-foreground text-center">
        Analyzed on {new Date(metadata.analyzed_at).toLocaleString()} · Model: {metadata.model}
      </p>
    </div>
  );
}
