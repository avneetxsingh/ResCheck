"use client";

import { useState } from "react";
import { AnalysisForm } from "@/components/analyze/AnalysisForm";
import { ResultsContainer } from "@/components/results/ResultsContainer";
import type { AnalysisResult } from "@/types/analysis";

export default function AnalyzePage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);

  if (result) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <ResultsContainer result={result} onReset={() => setResult(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Analyze Your Resume</h1>
        <p className="text-muted-foreground mt-1">
          Get an AI-powered ATS score, skill gap analysis, and line-by-line fixes in seconds.
        </p>
      </div>
      <AnalysisForm onResult={setResult} />
    </div>
  );
}
