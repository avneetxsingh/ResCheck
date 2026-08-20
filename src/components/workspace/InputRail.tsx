"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResumeUploader } from "@/components/analyze/ResumeUploader";
import { JobDescriptionInput } from "@/components/analyze/JobDescriptionInput";
import { ProgressStream } from "@/components/analyze/ProgressStream";
import type { AnalysisStage } from "@/hooks/useAnalysis";

interface InputRailProps {
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  file: File | null;
  onFileAccepted: (file: File) => void;
  onFileRejected: (reason: string) => void;
  onClear: () => void;
  fileError: string | null;
  canSubmit: boolean;
  isRunning: boolean;
  hydrated: boolean;
  hasKey: boolean;
  stage: AnalysisStage;
  progress: number;
  warnings: string[];
  error: string | null;
  onSubmit: () => void;
  onOpenSettings: () => void;
}

export function InputRail({
  jobDescription, onJobDescriptionChange, file, onFileAccepted, onFileRejected,
  onClear, fileError, canSubmit, isRunning, hydrated, hasKey,
  stage, progress, warnings, error, onSubmit, onOpenSettings,
}: InputRailProps) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="space-y-5 p-5 border-b border-border"
    >
      <p className="text-sm text-muted-foreground max-w-prose leading-relaxed">
        Check a résumé against a job posting. ResCheck reports what it can actually
        derive — whether the document parses, whether you meet the stated requirements,
        and whether a recruiter&apos;s search would find you. It does not score you.
      </p>

      {hydrated && !hasKey && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No API key set.{" "}
            <button
              type="button"
              onClick={onOpenSettings}
              className="font-medium text-primary underline underline-offset-2"
            >
              Open settings
            </button>{" "}
            to add one.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Résumé
          </p>
          <ResumeUploader
            file={file}
            onFileAccepted={onFileAccepted}
            onFileRejected={onFileRejected}
            onClear={onClear}
          />
          {fileError && (
            <p className="text-sm text-state-fail flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {fileError}
            </p>
          )}
        </div>

        <JobDescriptionInput value={jobDescription} onChange={onJobDescriptionChange} />
      </div>

      {isRunning && <ProgressStream stage={stage} progress={progress} />}

      {isRunning && warnings.length > 0 && (
        <ul className="space-y-1">
          {warnings.map((w, i) => (
            <li key={i} className="text-xs text-state-warn flex gap-1.5">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      {stage === "error" && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {isRunning ? "Analysing…" : "Analyse"}
        </Button>
        {!canSubmit && !isRunning && hydrated && (
          <p className="text-xs text-muted-foreground">
            {!hasKey
              ? "Add an API key in settings first"
              : !file
                ? "Add your résumé to continue"
                : "Paste a job description to continue"}
          </p>
        )}
      </div>
    </form>
  );
}
