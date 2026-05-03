"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalysisStage } from "@/hooks/useAnalysis";

interface Step {
  label: string;
  activeStage: AnalysisStage;
  completedAfter: AnalysisStage[];
}

const STEPS: Step[] = [
  { label: "Reading your PDF", activeStage: "parsing", completedAfter: ["analyzing", "complete"] },
  { label: "Extracting text", activeStage: "parsing", completedAfter: ["analyzing", "complete"] },
  { label: "AI analyzing resume", activeStage: "analyzing", completedAfter: ["complete"] },
  { label: "Generating report", activeStage: "analyzing", completedAfter: ["complete"] },
];

interface ProgressStreamProps {
  stage: AnalysisStage;
  progress: number;
}

export function ProgressStream({ stage, progress }: ProgressStreamProps) {
  if (stage === "idle" || stage === "complete") return null;

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">Analyzing your resume...</p>
        <span className="text-sm text-muted-foreground tabular-nums">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <ul className="space-y-3 pt-2">
        {STEPS.map((step, i) => {
          const isComplete = step.completedAfter.includes(stage);
          const isActive = step.activeStage === stage && !isComplete;

          return (
            <li key={i} className="flex items-center gap-3 text-sm">
              {isComplete ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              ) : isActive ? (
                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              )}
              <span
                className={cn(
                  "transition-colors",
                  isComplete && "text-green-500",
                  isActive && "text-foreground font-medium",
                  !isComplete && !isActive && "text-muted-foreground/60"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>

      {stage === "analyzing" && (
        <p className="text-xs text-muted-foreground pt-1">
          Powered by llama-3.1-8b-instant via Groq — this usually takes 3-8 seconds
        </p>
      )}
    </div>
  );
}
