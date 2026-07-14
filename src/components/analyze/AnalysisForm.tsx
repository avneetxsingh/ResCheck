"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AlertCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResumeUploader } from "./ResumeUploader";
import { JobDescriptionInput } from "./JobDescriptionInput";
import { ProgressStream } from "./ProgressStream";
import { useSettings } from "@/hooks/useSettings";
import { useAnalysis } from "@/hooks/useAnalysis";
import type { AnalysisResult } from "@/types/analysis";

interface AnalysisFormProps {
  onResult: (result: AnalysisResult) => void;
}

export function AnalysisForm({ onResult }: AnalysisFormProps) {
  const { settings, hydrated } = useSettings();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const { stage, progress, result, error, warnings, analyze } = useAnalysis(settings.apiKey);

  const reportedRef = useRef<AnalysisResult | null>(null);
  useEffect(() => {
    if (result && result !== reportedRef.current) {
      reportedRef.current = result;
      onResult(result);
    }
  }, [result, onResult]);

  const isRunning = stage === "parsing" || stage === "analyzing";
  const hasKey = settings.apiKey.length > 10;
  const canSubmit = hasKey && file !== null && jobDescription.trim().length > 0 && !isRunning;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    await analyze(file, jobDescription);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {hydrated && !hasKey && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            No Groq API key set.{" "}
            <Link href="/settings" className="font-medium text-primary hover:underline inline-flex items-center gap-1">
              <Settings className="w-3.5 h-3.5" />
              Open Settings
            </Link>{" "}
            to add your key.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="space-y-2">
          <p className="text-sm font-medium">Resume <span className="text-red-600 dark:text-red-400">*</span></p>
          <ResumeUploader
            file={file}
            onFileAccepted={(f) => { setFile(f); setFileError(null); }}
            onFileRejected={(reason) => { setFileError(reason); setFile(null); }}
            onClear={() => setFile(null)}
          />
          {fileError && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {fileError}
            </p>
          )}
        </div>

        <JobDescriptionInput value={jobDescription} onChange={setJobDescription} />
      </div>

      {isRunning && <ProgressStream stage={stage} progress={progress} />}

      {isRunning && warnings.length > 0 && (
        <ul className="space-y-1">
          {warnings.map((w, i) => (
            <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex gap-1.5">
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

      <Button type="submit" size="lg" disabled={!canSubmit} className="w-full gap-2">
        {isRunning ? "Analyzing…" : "Analyze My Resume"}
      </Button>

      {!canSubmit && !isRunning && hydrated && (
        <p className="text-xs text-center text-muted-foreground">
          {!hasKey
            ? "Add your Groq API key in Settings to get started"
            : !file
            ? "Upload your resume PDF"
            : "Add a job description"}
        </p>
      )}
    </form>
  );
}
