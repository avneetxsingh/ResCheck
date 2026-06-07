"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `err-${crypto.randomUUID()}`;
  }
  // Fallback for environments without crypto.randomUUID
  return `err-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isRawAnalysisResult(v: unknown): v is RawAnalysisResult {
  return (
    v !== null &&
    typeof v === "object" &&
    "scorecard" in v &&
    "errors" in v &&
    Array.isArray((v as RawAnalysisResult).errors) &&
    "summary" in v &&
    "skills_gap" in v &&
    "formatting_audit" in v &&
    "metadata" in v
  );
}

function enrichResult(raw: RawAnalysisResult): AnalysisResult {
  const errors: LineError[] = raw.errors.map((e) => ({
    ...e,
    id: generateId(),
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

  // Refs so we can clean up across renders without stale closures
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Monotonic counter — each analyze() call gets its own snapshot; stale completions are discarded
  const callCountRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (progressTimerRef.current !== null) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  const analyze = useCallback(
    async (file: File, jobDescription: string) => {
      if (!apiKey) {
        setError("Please enter your Groq API key first.");
        return;
      }

      // Cancel any in-flight request from a previous call
      abortControllerRef.current?.abort();
      if (progressTimerRef.current !== null) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const thisCall = ++callCountRef.current;

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
          signal: controller.signal,
        });

        if (thisCall !== callCountRef.current) return; // superseded by newer call
        setProgress(30);

        if (!parseRes.ok) {
          const err: ApiError = await parseRes.json();
          throw new Error(err.error);
        }

        const { text: resumeText } = await parseRes.json();

        // Step 2: Analyze with Groq
        setStage("analyzing");
        setProgress(40);

        progressTimerRef.current = setInterval(() => {
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
          signal: controller.signal,
        });

        if (progressTimerRef.current !== null) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }

        if (thisCall !== callCountRef.current) return; // superseded
        setProgress(90);

        if (!analyzeRes.ok) {
          const err: ApiError = await analyzeRes.json();
          throw new Error(err.error);
        }

        const responseBody = await analyzeRes.json();
        const rawResult: unknown = responseBody?.result;

        if (!isRawAnalysisResult(rawResult)) {
          throw new Error(
            "Received an unexpected response shape from the server. Please try again."
          );
        }

        const enriched = enrichResult(rawResult);

        if (thisCall !== callCountRef.current) return; // superseded

        setProgress(100);
        setResult(enriched);
        setStage("complete");

        const entry: HistoryEntry = {
          id: `analysis-${Date.now()}`,
          created_at: enriched.metadata.analyzed_at,
          job_title_hint: jobDescription.slice(0, 80),
          overall_score: enriched.scorecard.overall_ats_score.score,
          result: enriched,
        };
        addEntry(entry);
      } catch (err) {
        // AbortError = intentional cancel (new analysis started or component unmounted)
        if (err instanceof Error && err.name === "AbortError") return;
        if (thisCall !== callCountRef.current) return; // stale error from old call

        setStage("error");
        setProgress(0);
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
      }
    },
    [apiKey, addEntry, settings.model, settings.systemPrompt]
  );

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    if (progressTimerRef.current !== null) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setStage("idle");
    setProgress(0);
    setResult(null);
    setError(null);
  }, []);

  return { stage, progress, result, error, analyze, reset };
}
