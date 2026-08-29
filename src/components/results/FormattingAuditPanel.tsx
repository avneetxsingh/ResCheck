"use client";

import { CheckCircle2, AlertTriangle, Minus } from "lucide-react";
import type { FormattingAudit, AtsExtraction } from "@/types/analysis";
import { cn } from "@/lib/utils";

interface FormattingAuditPanelProps {
  audit: FormattingAudit;
  atsExtraction?: AtsExtraction;
}

const CATEGORIES: { key: keyof Omit<FormattingAudit, "is_clean">; label: string; description: string }[] = [
  {
    key: "whitespace_issues",
    label: "Whitespace",
    description: "Double spaces, trailing spaces, missing spaces after punctuation",
  },
  {
    key: "bold_inconsistencies",
    label: "Bold / italic",
    description: "Company names, job titles, or school names bolded inconsistently",
  },
  {
    key: "bullet_inconsistencies",
    label: "Bullets",
    description: "Mixed bullet characters, inconsistent period endings, indentation",
  },
  {
    key: "date_format_issues",
    label: "Dates",
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

export function FormattingAuditPanel({ audit, atsExtraction }: FormattingAuditPanelProps) {
  const totalIssues = CATEGORIES.reduce((sum, { key }) => sum + audit[key].length, 0);

  return (
    <div className="space-y-3">
      {/* What the ATS sees — only for pipeline v2 results */}
      {atsExtraction && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold">What the ATS sees</h3>
          <div className="flex flex-wrap gap-1.5">
            {atsExtraction.sections_detected.map((s) => (
              <span
                key={s}
                className="text-xs font-medium bg-muted text-muted-foreground border border-border/50 px-2 py-0.5 rounded-full capitalize"
              >
                {s}
              </span>
            ))}
            {atsExtraction.sections_detected.length === 0 && (
              <span className="text-xs text-muted-foreground">No sections detected</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            {(
              [
                ["Email", atsExtraction.contact.email],
                ["Phone", atsExtraction.contact.phone],
                ["Links", atsExtraction.contact.links.length > 0 ? `${atsExtraction.contact.links.length} found` : null],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex items-center gap-2">
                {value ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span className="text-xs">
                  <span className="font-medium">{label}:</span>{" "}
                  <span className={value ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"}>
                    {value ?? "not found"}
                  </span>
                </span>
              </div>
            ))}
          </div>
          {atsExtraction.warnings.length > 0 && (
            <ul className="space-y-1">
              {atsExtraction.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          )}

          {(atsExtraction.sections_missing?.length ?? 0) > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium">Not detected</h4>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {atsExtraction.sections_missing?.map((s) => (
                  <li key={s} className="font-mono text-xs text-muted-foreground">
                    {s} — no heading found
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(atsExtraction.sections_unrecognized?.length ?? 0) > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium">Found, but not read as a heading</h4>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {atsExtraction.sections_unrecognized?.map((u) => (
                  <li key={`${u.section}-${u.line_number}`} className="text-xs">
                    <span className="font-mono text-muted-foreground">
                      line {u.line_number}
                    </span>{" "}
                    <code className="font-mono">{u.text}</code>
                    <p className="text-muted-foreground mt-0.5">
                      The word is in your document; the parser read it as body text, so the{" "}
                      {u.section} section was never separated out.
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(atsExtraction.column_evidence?.length ?? 0) > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium">Signs of merged columns</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                These lines read as two columns run together. We see only the extracted text, not
                your layout, so this is what the text shows — not a verdict about your document.
              </p>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {atsExtraction.column_evidence?.map((e) => (
                  <li key={`${e.line_number}-${e.signal}`} className="font-mono text-xs text-muted-foreground">
                    line {e.line_number}: {e.line}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {audit.is_clean || totalIssues === 0 ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          )}
          <h3 className="text-sm font-semibold">
            Formatting
          </h3>
        </div>
        {totalIssues > 0 ? (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
            {totalIssues} to fix
          </span>
        ) : (
          <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
            Clean
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
