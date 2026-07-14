"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Lock, CheckCircle2, ExternalLink, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSettings } from "@/hooks/useSettings";
import { useHistory } from "@/hooks/useHistory";
import { GROQ_MODELS } from "@/lib/groq";
import { JD_SKILLS_PROMPT, LINE_AUDIT_PROMPT, SUMMARY_PROMPT } from "@/lib/prompts";
import { cn } from "@/lib/utils";

export function SettingsPanel() {
  const { settings, saveSettings, resetAll, hydrated, defaults } = useSettings();
  const { history: entries, clearAll } = useHistory();

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // Sync local state when settings hydrate
  useEffect(() => {
    if (hydrated) {
      setApiKey(settings.apiKey);
      setModel(settings.model);
    }
  }, [hydrated, settings]);

  const isValidKey = apiKey.startsWith("gsk_") && apiKey.length > 20;
  const hasUnsavedChanges = apiKey !== settings.apiKey || model !== settings.model;

  const handleSave = () => {
    saveSettings({ apiKey, model });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearHistory = () => {
    clearAll();
    setConfirmClearHistory(false);
  };

  const handleResetAll = () => {
    resetAll();
    setApiKey("");
    setModel(defaults.model);
    setConfirmResetAll(false);
  };

  if (!hydrated) return null;

  return (
    <div className="space-y-6">
      {/* API Key */}
      <Card className="border-border/50 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            Groq API Key
          </CardTitle>
          <CardDescription>
            Stored only in your browser. Never sent to our servers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="gsk_..."
              className={cn(
                "pr-20 font-mono text-sm",
                isValidKey && "border-primary focus-visible:ring-primary"
              )}
              autoComplete="off"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isValidKey && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowKey((s) => !s)}
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              Get a free Groq API key
              <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
            </a>
          </p>
        </CardContent>
      </Card>

      {/* Model */}
      <Card className="border-border/50 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Model</CardTitle>
          <CardDescription>Choose which Groq model to use for analysis.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {GROQ_MODELS.map((m) => (
              <label
                key={m.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                  model === m.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="model"
                    value={m.id}
                    checked={model === m.id}
                    onChange={() => setModel(m.id)}
                    className="accent-[var(--primary)]"
                  />
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{m.id}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground border rounded-full px-2 py-0.5">
                  {m.note}
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Prompts (read-only) */}
      <Card className="border-border/50 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Analysis Prompts</CardTitle>
          <CardDescription className="mt-1">
            Pipeline v2 uses three specialist prompts, applied server-side. They are shown here
            for transparency and cannot be edited — scoring is computed deterministically in code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: "JD Skill Extraction", prompt: JD_SKILLS_PROMPT },
            { name: "Resume Writing Audit", prompt: LINE_AUDIT_PROMPT },
            { name: "Executive Summary", prompt: SUMMARY_PROMPT },
          ].map(({ name, prompt }) => (
            <details key={name} className="rounded-lg border">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium hover:bg-muted/40 rounded-lg">
                {name}
              </summary>
              <pre className="px-3 pb-3 pt-1 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">
                {prompt}
              </pre>
            </details>
          ))}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={handleSave}
          disabled={!hasUnsavedChanges && !saved}
          className="gap-2"
        >
          {saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Settings
            </>
          )}
        </Button>
        {hasUnsavedChanges && (
          <p className="text-xs text-muted-foreground">You have unsaved changes</p>
        )}
      </div>

      {/* Danger zone */}
      <Card className="border-destructive/30 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Clear history */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Clear Analysis History</p>
              <p className="text-xs text-muted-foreground">
                Removes all {entries.length} saved analyses from your browser.
              </p>
            </div>
            {confirmClearHistory ? (
              <div className="flex gap-2 shrink-0">
                <Button type="button" variant="destructive" size="sm" onClick={handleClearHistory}>
                  Confirm
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmClearHistory(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setConfirmClearHistory(true)}
                disabled={entries.length === 0}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear History
              </Button>
            )}
          </div>

          <div className="border-t" />

          {/* Reset all */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Reset All Settings</p>
              <p className="text-xs text-muted-foreground">
                Clears your API key, resets model and prompt to defaults.
              </p>
            </div>
            {confirmResetAll ? (
              <div className="flex gap-2 shrink-0">
                <Button type="button" variant="destructive" size="sm" onClick={handleResetAll}>
                  Confirm Reset
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmResetAll(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setConfirmResetAll(true)}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
