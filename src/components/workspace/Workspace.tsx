"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Settings, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/useSettings";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useHistory } from "@/hooks/useHistory";
import { InputRail } from "./InputRail";
import { RunSummary } from "./RunSummary";
import { SettingsDialog } from "./SettingsDialog";
import { PastRuns } from "./PastRuns";
import { ResultsView } from "@/components/results/ResultsView";

export function Workspace() {
  // Single owner: useSettings keeps its state in useState, so a second call
  // site would hold an independent copy and a key saved in the dialog would
  // never reach the rail's "no API key" check.
  const { apiKey, hydrated, settings, saveSettings, defaults } = useSettings();
  const { stage, progress, result, error, warnings, analyze, reset } = useAnalysis(apiKey);
  const { history, removeEntry } = useHistory();
  // null means "show the live result"; an id means a past run is being viewed.
  const [viewingId, setViewingId] = useState<string | null>(null);

  const viewing = viewingId === null ? null : history.find((e) => e.id === viewingId) ?? null;
  const shown = viewing?.result ?? result;

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  // The rail collapses on its own once a result lands, but the user can
  // reopen it; that intent has to outlive the next render, so it is state.
  const [railOpen, setRailOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The theme toggle lived in Navbar, which Task 7 deletes. It is the only
  // toggle in the app, so the workspace header must carry it or the user is
  // stranded in whatever theme they last had.
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isRunning = stage === "parsing" || stage === "analyzing";
  const hasKey = apiKey.length > 10;
  const canSubmit = hasKey && file !== null && jobDescription.trim().length > 0 && !isRunning;

  const showRail = railOpen || (result === null && viewing === null);

  const handleSubmit = async () => {
    setViewingId(null);
    if (!file) return;
    await analyze(file, jobDescription);
    setRailOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border">
        <span className="font-mono text-sm font-semibold tracking-tight">ResCheck</span>
        <div className="flex items-center gap-1">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

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
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <RunSummary
          jobTitle={jobDescription.slice(0, 80) || "Untitled run"}
          fileName={file?.name ?? "résumé.pdf"}
          onReopen={() => setRailOpen(true)}
        />
      )}

      {shown && (
        <div className="p-5">
          <ResultsView
            result={shown}
            onReset={() => { reset(); setViewingId(null); setRailOpen(true); }}
          />
        </div>
      )}

      <PastRuns
        entries={history}
        activeId={viewingId}
        onSelect={(id) => { setViewingId(id); setRailOpen(false); }}
        onRemove={removeEntry}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        saveSettings={saveSettings}
        hydrated={hydrated}
        defaults={defaults}
      />
    </div>
  );
}
