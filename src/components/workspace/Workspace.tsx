"use client";

import { useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useAnalysis } from "@/hooks/useAnalysis";
import { InputRail } from "./InputRail";
import { RunSummary } from "./RunSummary";
import { ResultsContainer } from "@/components/results/ResultsContainer";

export function Workspace() {
  const { apiKey, hydrated } = useSettings();
  const { stage, progress, result, error, warnings, analyze, reset } = useAnalysis(apiKey);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  // The rail collapses on its own once a result lands, but the user can
  // reopen it; that intent has to outlive the next render, so it is state.
  const [railOpen, setRailOpen] = useState(true);

  const isRunning = stage === "parsing" || stage === "analyzing";
  const hasKey = apiKey.length > 10;
  const canSubmit = hasKey && file !== null && jobDescription.trim().length > 0 && !isRunning;

  const showRail = railOpen || result === null;

  const handleSubmit = async () => {
    if (!file) return;
    await analyze(file, jobDescription);
    setRailOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      {showRail ? (
        <InputRail
          jobDescription={jobDescription}
          onJobDescriptionChange={setJobDescription}
          file={file}
          onFileAccepted={(f) => { setFile(f); setFileError(null); }}
          onFileRejected={(reason) => { setFileError(reason); setFile(null); }}
          onClear={() => setFile(null)}
          fileError={fileError}
          canSubmit={canSubmit}
          isRunning={isRunning}
          hydrated={hydrated}
          hasKey={hasKey}
          stage={stage}
          progress={progress}
          warnings={warnings}
          error={error}
          onSubmit={handleSubmit}
          onOpenSettings={() => {}}
        />
      ) : (
        <RunSummary
          jobTitle={jobDescription.slice(0, 80) || "Untitled run"}
          fileName={file?.name ?? "résumé.pdf"}
          onReopen={() => setRailOpen(true)}
        />
      )}

      {result && (
        <div className="p-5">
          <ResultsContainer result={result} onReset={() => { reset(); setRailOpen(true); }} />
        </div>
      )}
    </div>
  );
}
