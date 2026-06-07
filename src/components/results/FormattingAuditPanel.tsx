"use client";

import { CheckCircle2, AlertTriangle, Minus } from "lucide-react";
import type { FormattingAudit } from "@/types/analysis";
import { cn } from "@/lib/utils";

interface FormattingAuditPanelProps {
  audit: FormattingAudit;
}

const CATEGORIES: { key: keyof Omit<FormattingAudit, "is_clean">; label: string; description: string }[] = [
  {
    key: "whitespace_issues",
    label: "Whitespace",
    description: "Double spaces, trailing spaces, missing spaces after punctuation",
  },
  {
    key: "bold_inconsistencies",
    label: "Bold / Italic",
    description: "Company names, job titles, or school names bolded inconsistently",
  },
  {
    key: "bullet_inconsistencies",
    label: "Bullet Style",
    description: "Mixed bullet characters, inconsistent period endings, indentation",
  },
  {
    key: "date_format_issues",
    label: "Date Formats",
    description: "Mixed formats across roles (Jan 2023 vs January 2023 vs 01/2023)",
  },
  {
    key: "capitalization_issues",
    label: "Capitalization",
    description: "Section headers, proper nouns, job titles cased inconsistently",
  },
  {
    key: "other_inconsistencies",
    label: "Other",
    description: "Phone format, URL style, structural inconsistencies",
  },
];

export function FormattingAuditPanel({ audit }: FormattingAuditPanelProps) {
  const totalIssues = CATEGORIES.reduce((sum, { key }) => sum + audit[key].length, 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {audit.is_clean || totalIssues === 0 ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          )}
          <h3 className="text-sm font-semibold">
            Formatting Audit
          </h3>
        </div>
        {totalIssues > 0 ? (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
            {totalIssues} inconsistenc{totalIssues === 1 ? "y" : "ies"}
          </span>
        ) : (
          <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
            All clear
          </span>
        )}
      </div>

      {/* Category rows */}
      <div className="rounded-lg border divide-y divide-border overflow-hidden">
        {CATEGORIES.map(({ key, label, description }) => {
          const items = audit[key];
          const clean = items.length === 0;

          return (
            <div key={key} className={cn("px-4 py-3", !clean && "bg-amber-500/3")}>
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  {clean ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{label}</span>
                    {clean ? (
                      <span className="text-xs text-muted-foreground">Consistent</span>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        {items.length} issue{items.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {clean ? (
                    <p className="text-xs text-muted-foreground">{description}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {items.map((item, i) => {
                        // Highlight text inside single quotes as inline code
                        const parts = item.split(/('(?:[^'\\]|\\.)*')/g);
                        return (
                          <li key={i} className="text-sm text-foreground flex gap-2">
                            <Minus className="w-3 h-3 mt-0.5 text-amber-500 shrink-0" />
                            <span>
                              {parts.map((part, j) =>
                                part.startsWith("'") && part.endsWith("'") ? (
                                  <code key={j} className="text-xs bg-muted px-1 py-0.5 rounded font-mono break-all">
                                    {part.slice(1, -1)}
                                  </code>
                                ) : (
                                  part
                                )
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
