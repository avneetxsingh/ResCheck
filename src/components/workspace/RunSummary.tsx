"use client";

import { RotateCcw } from "lucide-react";

interface RunSummaryProps {
  jobTitle: string;
  // Not always a file name — a viewed past run shows its date here instead.
  detail: string;
  onReopen: () => void;
}

// The collapsed rail. It is a real button rather than a div-with-handlers
// because the whole strip does exactly one thing: reopen the editor.
export function RunSummary({ jobTitle, detail, onReopen }: RunSummaryProps) {
  return (
    <button
      type="button"
      onClick={onReopen}
      className="w-full flex items-center gap-3 px-5 py-3 text-left border-b border-border hover:bg-muted/40 transition-colors"
    >
      <span className="text-sm truncate min-w-0 flex-1">{jobTitle}</span>
      <span className="font-mono text-xs text-muted-foreground truncate max-w-[14rem]">
        {detail}
      </span>
      <RotateCcw className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
      <span className="sr-only">Edit inputs and run again</span>
    </button>
  );
}
