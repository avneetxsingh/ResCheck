"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { History, Settings, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/useSettings";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useHistory } from "@/hooks/useHistory";
import { useFreeRuns } from "@/hooks/useFreeRuns";
import { InputRail } from "./InputRail";
import { RunSummary } from "./RunSummary";
import { SettingsDialog } from "./SettingsDialog";
import { HistoryPanel } from "./HistoryPanel";
import { ResultsView } from "@/components/results/ResultsView";

export function Workspace() {
  // Single owner: useSettings keeps its state in useState, so a second call
  // site would hold an independent copy and a key saved in the dialog would
  // never reach the rail's "no API key" check.
  const { apiKey, hydrated, settings, saveSettings, defaults } = useSettings();
  const { history, addEntry, removeEntry } = useHistory();
  const {
    remaining: freeRunsRemaining,
    limit: freeRunLimit,
    available: hostedAvailable,
    hydrated: freeRunsHydrated,
    setRemaining: setFreeRunsRemaining,
    refund: refundFreeRun,
  } = useFreeRuns();
  const { stage, progress, result, partial, error, warnings, analyze, reset } = useAnalysis(
    apiKey,
    settings.provider,
    settings.model,
    freeRunLimit,
    addEntry,
    setFreeRunsRemaining,
    refundFreeRun
  );
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
  const [historyOpen, setHistoryOpen] = useState(false);
  // The theme toggle lived in Navbar, which Task 7 deletes. It is the only
  // toggle in the app, so the workspace header must carry it or the user is
  // stranded in whatever theme they last had.
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isRunning = stage === "parsing" || stage === "analyzing";
  // Matches useAnalysis's own definition of "has a key" exactly. A length
  // heuristic here previously disagreed with useAnalysis (>10 vs non-empty):
  // an 8-character key read as "no key" by the rail, which promised free
  // analyses, while useAnalysis saw a non-empty key and billed the run to it
  // anyway — a guaranteed "Invalid API key" one line under "no key needed".
  // SettingsDialog keeps its own stricter validity hint; that heuristic
  // belongs there, not here.
  const hasKey = apiKey.trim().length > 0;
  // A visitor with no key is the normal case now: they run on ours until the
  // free allowance is gone. Only then does a key become required.
  const outOfFreeRuns = freeRunsHydrated && !hasKey && (hostedAvailable === true) && freeRunsRemaining === 0;
  // Hosted analysis was never configured on this deployment. A visitor here has
  // not "used up" anything, and must not be told they have. Only claim
  // unavailability when the server explicitly answered false, not when the
  // fetch failed (available is null in that case — we do not know).
  const hostedUnavailable = freeRunsHydrated && !hasKey && (hostedAvailable === false);
  const needsOwnKey = outOfFreeRuns || hostedUnavailable;
  const canSubmit = file !== null && jobDescription.trim().length > 0 && !isRunning && !needsOwnKey;

  const showRail = railOpen || (result === null && viewing === null);

  const handleSubmit = async () => {
    setViewingId(null);
    if (!file) return;
    await analyze(file, jobDescription);
    setRailOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
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
            onClick={() => setHistoryOpen(true)}
            aria-label={
              history.length > 0
                ? `History, ${history.length} past ${history.length === 1 ? "run" : "runs"}`
                : "History"
            }
            className="relative"
          >
            <History className="w-4 h-4" />
            {history.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 rounded-full bg-muted px-1 font-mono text-[10px] leading-tight text-muted-foreground">
                {history.length}
              </span>
            )}
          </Button>
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
          freeRunsRemaining={freeRunsRemaining}
          freeRunLimit={freeRunLimit}
          outOfFreeRuns={outOfFreeRuns}
          hostedUnavailable={hostedUnavailable}
          needsOwnKey={needsOwnKey}
          stage={stage}
          progress={progress}
          warnings={warnings}
          error={error}
          onSubmit={handleSubmit}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <RunSummary
          jobTitle={viewing ? viewing.job_title_hint : (jobDescription.slice(0, 80) || "Untitled run")}
          detail={
            viewing
              ? new Date(viewing.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : (file?.name ?? "résumé.pdf")
          }
          onReopen={() => { setViewingId(null); setRailOpen(true); }}
        />
      )}

      {(shown || partial) && (
        <div className="p-6">
          <ResultsView
            result={shown}
            partial={viewing ? null : partial}
            onReset={() => { reset(); setViewingId(null); setRailOpen(true); }}
          />
        </div>
      )}

      <HistoryPanel
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        entries={history}
        activeId={viewingId}
        onSelect={(id) => { setViewingId(id); setRailOpen(false); }}
        onRemove={(id) => { removeEntry(id); if (id === viewingId) setViewingId(null); }}
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
