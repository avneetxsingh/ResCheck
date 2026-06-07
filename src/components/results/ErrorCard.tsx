"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiffView } from "./DiffView";
import type { LineError } from "@/types/analysis";
import { cn } from "@/lib/utils";

interface ErrorCardProps {
  error: LineError;
}

const SEVERITY_STYLES = {
  critical: "border-l-red-500",
  moderate: "border-l-amber-500",
  minor: "border-l-blue-400",
};

const SEVERITY_BADGE = {
  critical: "bg-red-500/10 text-red-600 dark:text-red-400",
  moderate: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  minor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const ERROR_TYPE_LABELS: Record<string, string> = {
  grammar: "Grammar",
  spelling: "Spelling",
  punctuation: "Punctuation",
  weak_verb: "Weak Verb",
  passive_voice: "Passive Voice",
  quantification_missing: "No Metrics",
  vague_language: "Vague Language",
  keyword_missing: "Missing Keyword",
  formatting: "Formatting",
  ats_unfriendly: "ATS Unfriendly",
  redundancy: "Redundancy",
  tense_inconsistency: "Tense Issue",
  extra_whitespace: "Extra Space",
  inconsistent_bold: "Bold Inconsistency",
  inconsistent_bullets: "Bullet Inconsistency",
  date_format: "Date Format",
  capitalization_inconsistency: "Capitalization",
};

export function ErrorCard({ error }: ErrorCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(error.fixed_line);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("rounded-lg border border-l-4 bg-card overflow-hidden", SEVERITY_STYLES[error.severity])}>
      {/* Header */}
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", SEVERITY_BADGE[error.severity])}>
              {error.severity}
            </span>
            <Badge variant="outline" className="text-xs">
              {ERROR_TYPE_LABELS[error.error_type] || error.error_type}
            </Badge>
            <span className="text-xs text-muted-foreground capitalize">{error.section}</span>
          </div>
          <p className="text-sm text-muted-foreground truncate">{error.original_line}</p>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-4">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Why: </span>
            {error.reason}
          </p>
          <DiffView original={error.original_line} fixed={error.fixed_line} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy fixed line
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
