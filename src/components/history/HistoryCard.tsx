"use client";

import { useState } from "react";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "@/components/results/ScoreRing";
import { ResultsContainer } from "@/components/results/ResultsContainer";
import type { HistoryEntry } from "@/types/history";

interface HistoryCardProps {
  entry: HistoryEntry;
  onRemove: (id: string) => void;
}

const VERDICT_BADGE = {
  strong: "bg-green-500/10 text-green-600 dark:text-green-400",
  moderate: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  needs_work: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  critical: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const VERDICT_LABELS = {
  strong: "Strong",
  moderate: "Moderate",
  needs_work: "Needs Work",
  critical: "Critical",
};

export function HistoryCard({ entry, onRemove }: HistoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const verdict = entry.result.summary.verdict;

  return (
    <Card className="overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v); }}
      >
        <ScoreRing score={entry.overall_score} size="sm" animate={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${VERDICT_BADGE[verdict]}`}>
              {VERDICT_LABELS[verdict]}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(entry.created_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>
          <p className="text-sm truncate text-muted-foreground">{entry.job_title_hint}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-red-500"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(entry.id);
            }}
            aria-label="Delete analysis"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <CardContent className="border-t pt-6">
          <ResultsContainer result={entry.result} onReset={() => setExpanded(false)} />
        </CardContent>
      )}
    </Card>
  );
}
