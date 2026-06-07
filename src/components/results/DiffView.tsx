"use client";

import { useMemo } from "react";
import { diffWords } from "diff";
import { cn } from "@/lib/utils";

interface DiffViewProps {
  original: string;
  fixed: string;
}

export function DiffView({ original, fixed }: DiffViewProps) {
  const changes = useMemo(() => diffWords(original, fixed), [original, fixed]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      {/* Original */}
      <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
        <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2 uppercase tracking-wide">
          Original
        </p>
        <p className="leading-relaxed">
          {changes.map((part, i) =>
            part.removed ? (
              <span key={i} className="bg-red-200 dark:bg-red-900/60 text-red-800 dark:text-red-200 rounded px-0.5">
                {part.value}
              </span>
            ) : !part.added ? (
              <span key={i}>{part.value}</span>
            ) : null
          )}
        </p>
      </div>

      {/* Fixed */}
      <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3">
        <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-2 uppercase tracking-wide">
          Fixed
        </p>
        <p className="leading-relaxed">
          {changes.map((part, i) =>
            part.added ? (
              <span key={i} className="bg-green-200 dark:bg-green-900/60 text-green-800 dark:text-green-200 rounded px-0.5">
                {part.value}
              </span>
            ) : !part.removed ? (
              <span key={i}>{part.value}</span>
            ) : null
          )}
        </p>
      </div>
    </div>
  );
}
