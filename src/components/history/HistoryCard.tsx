"use client";

import { useState } from "react";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultsContainer } from "@/components/results/ResultsContainer";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/types/history";

interface HistoryCardProps {
  entry: HistoryEntry;
  onRemove: (id: string) => void;
}

const VERDICT_LABELS = {
  strong: "Strong",
  moderate: "Moderate",
  needs_work: "Needs work",
  critical: "Critical",
};

function scoreColorClass(score: number) {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function HistoryCard({ entry, onRemove }: HistoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const verdict = entry.result.summary.verdict;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center gap-4 px-1 py-4 text-left hover:bg-muted/30 transition-colors cursor-pointer rounded-lg"
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v); }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{entry.job_title_hint}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(entry.created_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
            {" · "}
            {VERDICT_LABELS[verdict]}
          </p>
        </div>
        <span className={cn("text-2xl font-light tabular-nums shrink-0", scoreColorClass(entry.overall_score))}>
          {entry.overall_score}
        </span>
        <div className="flex items-center gap-1 shrink-0">
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
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="pt-2 pb-6">
          <ResultsContainer result={entry.result} onReset={() => setExpanded(false)} />
        </div>
      )}
    </div>
  );
}
