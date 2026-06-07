"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { ErrorCard } from "./ErrorCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LineError, ResumeSection } from "@/types/analysis";

interface ErrorReportPanelProps {
  errors: LineError[];
}

type SeverityFilter = "all" | "critical" | "moderate" | "minor";
type SectionFilter = "all" | ResumeSection;

const ALL_SECTIONS: ResumeSection[] = [
  "contact", "summary", "experience", "education",
  "skills", "projects", "certifications", "other",
];

export function ErrorReportPanel({ errors }: ErrorReportPanelProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>("all");

  const counts = {
    critical: errors.filter((e) => e.severity === "critical").length,
    moderate: errors.filter((e) => e.severity === "moderate").length,
    minor: errors.filter((e) => e.severity === "minor").length,
  };

  // Only show section buttons for sections that actually have errors
  const activeSections = ALL_SECTIONS.filter((s) =>
    errors.some((e) => e.section === s)
  );

  const filtered = errors.filter((e) => {
    const severityMatch = severityFilter === "all" || e.severity === severityFilter;
    const sectionMatch = sectionFilter === "all" || e.section === sectionFilter;
    return severityMatch && sectionMatch;
  });

  const sectionCount = (section: ResumeSection) =>
    errors.filter((e) => e.section === section).length;

  if (errors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
        <p className="text-lg font-medium">No errors found</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your resume is clean! The AI found no grammar, spelling, or formatting issues.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/40 flex-wrap">
        <span className="text-sm font-medium">{errors.length} issues found</span>
        <div className="flex items-center gap-2 flex-wrap">
          {counts.critical > 0 && (
            <span className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
              {counts.critical} critical
            </span>
          )}
          {counts.moderate > 0 && (
            <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
              {counts.moderate} moderate
            </span>
          )}
          {counts.minor > 0 && (
            <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
              {counts.minor} minor
            </span>
          )}
        </div>
      </div>

      {/* Severity filter */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">By Severity</p>
        <div className="flex gap-2 flex-wrap">
          {(["all", "critical", "moderate", "minor"] as SeverityFilter[]).map((s) => (
            <Button
              key={s}
              variant={severityFilter === s ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setSeverityFilter(s)}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== "all" && counts[s] > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {counts[s as keyof typeof counts]}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Section filter — only shown when errors span 2+ sections */}
      {activeSections.length >= 2 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">By Section</p>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={sectionFilter === "all" ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setSectionFilter("all")}
            >
              All Sections
            </Button>
            {activeSections.map((section) => (
              <Button
                key={section}
                variant={sectionFilter === section ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 capitalize"
                onClick={() => setSectionFilter(section)}
              >
                {section}
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {sectionCount(section)}
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Error list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No errors match the current filters.
          </p>
        ) : (
          filtered.map((error) => (
            <ErrorCard key={error.id} error={error} />
          ))
        )}
      </div>
    </div>
  );
}
