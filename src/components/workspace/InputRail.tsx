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
  freeRunsRemaining: number | null;
  freeRunLimit: number;
  outOfFreeRuns: boolean;
  hostedUnavailable: boolean;
  needsOwnKey: boolean;
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
  freeRunsRemaining, freeRunLimit, outOfFreeRuns, hostedUnavailable, needsOwnKey,
  stage, progress, warnings, error, onSubmit, onOpenSettings,
}: InputRailProps) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="space-y-7 px-6 py-8 border-b border-border"
    >
      <p className="text-[length:var(--step--1)] text-muted-foreground max-w-prose leading-relaxed">
        Check a résumé against a job posting. ResCheck reports what it can actually
        derive — whether the document parses, whether you meet the stated requirements,
        and whether a recruiter&apos;s search would find you. It does not score you.
      </p>

      {hydrated && !hasKey && !needsOwnKey && freeRunsRemaining !== null && (
        <p className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">{freeRunsRemaining}</span>{" "}
          {freeRunsRemaining === 1 ? "free analysis" : "free analyses"} left on us — no key needed.{" "}
          <button
            type="button"
            onClick={onOpenSettings}
            className="font-medium text-primary underline underline-offset-2"
          >
            Add your own key
          </button>{" "}
          for unlimited runs.
        </p>
      )}

      {hydrated && outOfFreeRuns && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You&apos;ve used your {freeRunLimit} free {freeRunLimit === 1 ? "analysis" : "analyses"}.{" "}
            <button
              type="button"
              onClick={onOpenSettings}
              className="font-medium text-primary underline underline-offset-2"
            >
              Add your own API key
            </button>{" "}
            for unlimited runs — it stays in your browser and never reaches our servers.
          </AlertDescription>
        </Alert>
      )}

      {hydrated && hostedUnavailable && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Free analyses aren&apos;t available on this deployment.{" "}
            <button
              type="button"
              onClick={onOpenSettings}
              className="font-medium text-primary underline underline-offset-2"
            >
              Add your own API key
            </button>{" "}
            to run one — it stays in your browser.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-2">
          <p className="text-sm font-medium">Résumé</p>
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

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={!canSubmit}>
          {isRunning ? "Analysing…" : "Analyse"}
        </Button>
        {!canSubmit && !isRunning && hydrated && (
          <p className="text-xs text-muted-foreground">
            {needsOwnKey
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
