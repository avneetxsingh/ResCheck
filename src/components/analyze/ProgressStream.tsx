"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalysisStage } from "@/hooks/useAnalysis";

const STEPS = [
  "Reading your PDF",
  "Extracting resume structure",
  "Matching skills from the job description",
  "Auditing writing line by line",
  "Computing scores",
  "Writing your summary",
] as const;

// SSE `progress` → index of the active row. 35 is the client-set value at
// analyze start, before the first server stage event lands.
const PROGRESS_TO_STEP: Record<number, number> = {
  35: 1, // analyzing started, first server event pending
  10: 1, // extracting
  25: 2, // skills
  50: 3, // errors
  70: 4, // scoring
  85: 5, // summary
};

interface ProgressStreamProps {
  stage: AnalysisStage;
  progress: number;
}

export function ProgressStream({ stage, progress }: ProgressStreamProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (stage === "parsing") {
      setActiveStep(0);
      return;
    }
    if (stage === "analyzing") {
      const mapped = PROGRESS_TO_STEP[progress];
      // Monotonic: never move backwards even if values arrive oddly
      if (mapped !== undefined) setActiveStep((s) => Math.max(s, mapped));
    }
  }, [stage, progress]);

  if (stage === "idle" || stage === "complete" || stage === "error") return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <ul className="space-y-3">
        {STEPS.map((label, i) => {
          const isDone = i < activeStep;
          const isActive = i === activeStep;

          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span className="w-4 shrink-0 flex items-center justify-center">
                {isDone ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin motion-reduce:animate-none" />
                ) : (
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                )}
              </span>
              <span
                className={cn(
                  "transition-colors duration-200",
                  isDone && "text-muted-foreground",
                  isActive && "text-foreground font-medium",
                  !isDone && !isActive && "text-muted-foreground/50"
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
