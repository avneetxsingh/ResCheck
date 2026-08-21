"use client";

import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/types/history";

interface PastRunsProps {
  entries: HistoryEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

// Renders nothing at all when history is empty — an empty-state card would be
// one more box on a screen whose whole point is having no boxes to ignore.
export function PastRuns({ entries, activeId, onSelect, onRemove }: PastRunsProps) {
  if (entries.length === 0) return null;

  return (
    <div className="border-t border-border">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground px-5 pt-4 pb-2">
        Past runs
      </p>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(entry.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(entry.id);
                }
              }}
              className={cn(
                "w-full flex items-center gap-3 px-5 py-2.5 text-left cursor-pointer transition-colors",
                activeId === entry.id ? "bg-muted/60" : "hover:bg-muted/30"
              )}
            >
              <span className="text-sm truncate min-w-0 flex-1">{entry.job_title_hint}</span>
              <span className="font-mono text-xs text-muted-foreground shrink-0">
                {new Date(entry.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {typeof entry.overall_score === "number" && (
                <span className="font-mono text-xs tabular-nums text-muted-foreground shrink-0">
                  {entry.overall_score}
                </span>
              )}
              <span
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="shrink-0"
              >
                <button
                  type="button"
                  onClick={() => onRemove(entry.id)}
                  aria-label={`Delete run: ${entry.job_title_hint}`}
                  className="p-1 rounded text-muted-foreground hover:text-state-fail transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
