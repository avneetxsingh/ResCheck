"use client";

import { useState, useCallback } from "react";
import { useHistory } from "./useHistory";
import { useSettings } from "./useSettings";
import type { AnalysisResult, RawAnalysisResult, LineError } from "@/types/analysis";
import type { HistoryEntry } from "@/types/history";
import type { ApiError } from "@/types/api";

export type AnalysisStage =
  | "idle"
  | "parsing"
  | "analyzing"
  | "complete"
  | "error";

function enrichResult(raw: RawAnalysisResult): AnalysisResult {
  let errorIndex = 0;
  const errors: LineError[] = raw.errors.map((e) => ({
    ...e,
    id: `err-${Date.now()}-${errorIndex++}`,
  }));
  return {
    ...raw,
    errors,
    metadata: {
      ...raw.metadata,
      analyzed_at: new Date().toISOString(),
    },
  };
}

export function useAnalysis(apiKey: string) {
  const [stage, setStage] = useState<AnalysisStage>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addEntry } = useHistory();
  const { settings } = useSettings();

  const analyze = useCallback(
    async (file: File, jobDescription: string) => {
      if (!apiKey) {
        setError("Please enter your Groq API key first.");
        return;
      }

      setStage("parsing");
      setProgress(5);
      setError(null);
      setResult(null);

      try {
        // Step 1: Parse PDF
        setProgress(10);
        const formData = new FormData();
        formData.append("resume", file);

        const parseRes = await fetch("/api/parse-pdf", {
          method: "POST",
          body: formData,
        });

        setProgress(30);

        if (!parseRes.ok) {
          const err: ApiError = await parseRes.json();
          throw new Error(err.error);
        }

        const { text: resumeText } = await parseRes.json();

        // Step 2: Analyze with Groq
        setStage("analyzing");
        setProgress(40);

        // Simulate progress while waiting for Groq
        const progressTimer = setInterval(() => {
          setProgress((p) => (p < 85 ? p + 2 : p));
        }, 400);

        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-groq-api-key": apiKey,
          },
          body: JSON.stringify({
            resume_text: resumeText,
            job_description: jobDescription,
            model: settings.model,
            system_prompt: settings.systemPrompt,
          }),
        });

        clearInterval(progressTimer);
        setProgress(90);

        if (!analyzeRes.ok) {
          const err: ApiError = await analyzeRes.json();
          throw new Error(err.error);
        }

        const { result: rawResult } = await analyzeRes.json();
        const enriched = enrichResult(rawResult);

        setProgress(100);
        setResult(enriched);
        setStage("complete");

        // Save to history
        const entry: HistoryEntry = {
          id: `analysis-${Date.now()}`,
          created_at: enriched.metadata.analyzed_at,
          job_title_hint: jobDescription.slice(0, 80),
          overall_score: enriched.scorecard.overall_ats_score.score,
          result: enriched,
        };
        addEntry(entry);
      } catch (err) {
        setStage("error");
        setProgress(0);
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      }
    },
    [apiKey, addEntry]
  );

  const reset = useCallback(() => {
    setStage("idle");
    setProgress(0);
    setResult(null);
    setError(null);
  }, []);

  return { stage, progress, result, error, analyze, reset };
}
