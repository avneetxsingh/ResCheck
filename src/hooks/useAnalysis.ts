"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AnalysisResult, RawAnalysisResult, LineError } from "@/types/analysis";
import type { HistoryEntry } from "@/types/history";
import type { ApiError, PartialAnalysis } from "@/types/api";
import type { ProviderId } from "@/lib/providers/catalog";
import { readFreeRunsUsedHint, writeFreeRunsUsedHint } from "@/lib/free-runs-storage";

// Mirrors MAX_PAGES in src/lib/pdf-parser.ts, which is server-only
// (createRequire) and so cannot be imported here. Change both together.
const PARSED_PAGE_LIMIT = 20;

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

interface SseEvent {
  event: string;
  data: unknown;
}

function parseSseFrame(frame: string): SseEvent | null {
  let event = "message";
  let dataStr = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    else if (line.startsWith("data: ")) dataStr += line.slice(6);
  }
  if (!dataStr) return null;
  try {
    return { event, data: JSON.parse(dataStr) };
  } catch {
    return null;
  }
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

// apiKey, provider, and model arrive as parameters rather than through a
// local useSettings() call. useSettings keeps its state in per-instance
// useState with no cross-instance sync; a second instance here would hold
// its own copy that drifts from the one the settings dialog writes through
// the moment the dialog stopped unmounting the tree (workspace restructure).
// Likewise onComplete replaces an internal useHistory() — that hook's
// addEntry would write to localStorage from an instance the Past Runs list
// never reads, so a finished run wouldn't appear until reload.
export function useAnalysis(
  apiKey: string,
  provider: ProviderId,
  model: string,
  // The authoritative limit from GET /api/free-runs (FreeRunsResponse.limit),
  // not a literal — a hardcoded 2 here would silently go stale the day the
  // server-side FREE_RUN_LIMIT changes, while the meter kept showing the old
  // number.
  freeRunLimit: number,
  onComplete?: (entry: HistoryEntry) => void,
  onFreeRunsRemaining?: (remaining: number) => void,
  // Takes the refund token off the terminal error event — a run that never
  // reached that event (network drop, unreadable stream) has no token to
  // offer, and refund() itself treats that as "nothing to refund" rather
  // than firing a request the server can only refuse.
  onHostedRunFailed?: (refundToken: string | undefined) => void
) {
  const [stage, setStage] = useState<AnalysisStage>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  // The two gates that land ~18s before the rest. Cleared on every new run.
  const [partial, setPartial] = useState<PartialAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Refs so we can clean up across renders without stale closures
  const abortControllerRef = useRef<AbortController | null>(null);
  // Monotonic counter — each analyze() call gets its own snapshot; stale completions are discarded
  const callCountRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const analyze = useCallback(
    async (file: File, jobDescription: string) => {
      // Cancel any in-flight request from a previous call
      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const thisCall = ++callCountRef.current;

      setStage("parsing");
      setProgress(5);
      setError(null);
      setResult(null);
      setPartial(null);
      setWarnings([]);

      const usingHosted = apiKey.trim().length === 0;
      // Flips true only once the analyze response itself came back 200 — the
      // server writes its Set-Cookie (charging this run) before the SSE body
      // streams, so a pre-stream 400/403/503 never charged anything and must
      // never trigger a refund below.
      let chargedHostedRun = false;
      // Declared outside the try block so the catch block below can still
      // read whatever the terminal error event set before the throw.
      let refundToken: string | undefined;

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

        const { text: resumeText, page_count: pageCount } = await parseRes.json();

        // The parser stops at PARSED_PAGE_LIMIT so an unauthenticated endpoint
        // cannot be made to walk an arbitrarily long document. It still reports
        // the true page count, and this is where that becomes visible —
        // silently analysing the first N pages would quietly skew dated
        // experience and the employment-gap signals, which are computed only
        // from what was read.
        if (typeof pageCount === "number" && pageCount > PARSED_PAGE_LIMIT) {
          setWarnings((w) => [
            ...w,
            `Only the first ${PARSED_PAGE_LIMIT} pages of your ${pageCount}-page resume were read. Anything after that wasn't analysed, including dates and employment gaps.`,
          ]);
        }

        // Step 2: Analyze — SSE stream with real per-stage progress
        setStage("analyzing");
        setProgress(35);

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (!usingHosted) headers["x-provider-api-key"] = apiKey;
        // Corroborates the server's cookie: clearing cookies does not always
        // clear localStorage, so this keeps the cap meaningful in that case.
        if (usingHosted) {
          const seen = readFreeRunsUsedHint();
          if (seen) headers["x-free-runs-used"] = seen;
        }

        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers,
          body: JSON.stringify(
            usingHosted
              ? { resume_text: resumeText, job_description: jobDescription }
              : { resume_text: resumeText, job_description: jobDescription, provider, model }
          ),
          signal: controller.signal,
        });

        if (thisCall !== callCountRef.current) return; // superseded

        const remainingHeader = analyzeRes.headers.get("X-Free-Runs-Remaining");
        if (remainingHeader !== null) {
          const n = Number(remainingHeader);
          if (Number.isInteger(n) && n >= 0) {
            onFreeRunsRemaining?.(n);
            writeFreeRunsUsedHint(freeRunLimit - n);
          }
        }

        // Pre-stream validation failures come back as plain JSON with a 4xx status
        if (!analyzeRes.ok) {
          const err: ApiError = await analyzeRes.json();
          throw new Error(err.error);
        }
        // A 200 here means the server already charged this run — anything
        // that fails from this point on refunds it.
        chargedHostedRun = true;
        if (!analyzeRes.body) {
          throw new Error("Your browser doesn't support streamed responses — try a current Chrome, Safari, or Firefox.");
        }

        const reader = analyzeRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let rawResult: unknown = null;
        let streamError: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const evt = parseSseFrame(frame);
            if (!evt) continue;
            if (thisCall !== callCountRef.current) return; // superseded

            if (evt.event === "stage") {
              const d = evt.data as { progress?: number };
              if (typeof d.progress === "number") setProgress(Math.min(95, d.progress));
            } else if (evt.event === "warning") {
              const d = evt.data as { message?: string };
              if (typeof d.message === "string") {
                const message = d.message;
                setWarnings((w) => [...w, message]);
              }
            } else if (evt.event === "partial") {
              // The same computation the terminal result carries, arriving
              // early. It is never contradicted by the final result.
              if (thisCall === callCountRef.current) setPartial(evt.data as PartialAnalysis);
            } else if (evt.event === "result") {
              rawResult = (evt.data as { result?: unknown }).result ?? null;
            } else if (evt.event === "error") {
              const d = evt.data as { error?: string; refund_token?: string };
              streamError = typeof d.error === "string" ? d.error : "Analysis failed.";
              // Absent on non-hosted runs and on any run the server never
              // charged — optional by construction, never assumed present.
              refundToken = typeof d.refund_token === "string" ? d.refund_token : undefined;
            }
          }
        }

        if (streamError) throw new Error(streamError);
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
          overall_score: enriched.scorecard.overall_ats_score?.score,
          result: enriched,
        };
        onComplete?.(entry);
      } catch (err) {
        // AbortError = intentional cancel (new analysis started or component unmounted)
        if (err instanceof Error && err.name === "AbortError") return;
        if (thisCall !== callCountRef.current) return; // stale error from old call

        // Only a charged run gets refunded — a 403 FREE_RUNS_EXHAUSTED or a
        // 503 HOSTED_* response above never reached this point. refundToken
        // may still be undefined here (e.g. the stream never reached a
        // terminal error event) — onHostedRunFailed/refund() must treat an
        // absent token as nothing to refund, not throw.
        if (chargedHostedRun && usingHosted) onHostedRunFailed?.(refundToken);

        setStage("error");
        setProgress(0);
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
      }
    },
    [apiKey, provider, model, freeRunLimit, onComplete, onFreeRunsRemaining, onHostedRunFailed]
  );

  const reset = useCallback(() => {
    setPartial(null);
    abortControllerRef.current?.abort();
    setStage("idle");
    setProgress(0);
    setResult(null);
    setError(null);
    setWarnings([]);
  }, []);

  return { stage, progress, result, partial, error, warnings, analyze, reset };
}
