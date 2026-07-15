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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Analyze</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Paste the job description, drop your resume, and get your report.
        </p>
      </div>
      <AnalysisForm onResult={setResult} />
    </div>
  );
}
