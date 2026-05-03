"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Lock, CheckCircle2, ExternalLink, RotateCcw, Save, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSettings } from "@/hooks/useSettings";
import { useHistory } from "@/hooks/useHistory";
import { GROQ_MODELS } from "@/lib/groq";
import { cn } from "@/lib/utils";

export function SettingsPanel() {
  const { settings, saveSettings, resetPrompt, resetAll, hydrated, isPromptCustomized, defaults } = useSettings();
  const { history: entries, clearAll } = useHistory();

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // Sync local state when settings hydrate
  useEffect(() => {
    if (hydrated) {
      setApiKey(settings.apiKey);
      setModel(settings.model);
      setSystemPrompt(settings.systemPrompt);
    }
  }, [hydrated, settings]);

  const isValidKey = apiKey.startsWith("gsk_") && apiKey.length > 20;
  const hasUnsavedChanges =
    apiKey !== settings.apiKey ||
    model !== settings.model ||
    systemPrompt !== settings.systemPrompt;

  const handleSave = () => {
    saveSettings({ apiKey, model, systemPrompt });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetPrompt = () => {
    setSystemPrompt(defaults.systemPrompt);
    resetPrompt();
  };

  const handleClearHistory = () => {
    clearAll();
    setConfirmClearHistory(false);
  };

  const handleResetAll = () => {
    resetAll();
    setApiKey("");
    setModel(defaults.model);
    setSystemPrompt(defaults.systemPrompt);
    setConfirmResetAll(false);
  };

  if (!hydrated) return null;

  return (
    <div className="space-y-6">
      {/* API Key */}
      <Card>
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
                isValidKey && "border-green-500 focus-visible:ring-green-500"
              )}
              autoComplete="off"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isValidKey && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
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
              className="inline-flex items-center gap-0.5 text-indigo-500 hover:underline"
            >
              Get a free Groq API key
              <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
            </a>
          </p>
        </CardContent>
      </Card>

      {/* Model */}
      <Card>
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
                    ? "border-indigo-500 bg-indigo-500/5"
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
                    className="accent-indigo-600"
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

      {/* System Prompt */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">System Prompt</CardTitle>
              <CardDescription className="mt-1">
                Controls how the AI analyzes your resume. Edit to change scoring behavior or output focus.
              </CardDescription>
            </div>
            {isPromptCustomized && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 text-xs"
                onClick={handleResetPrompt}
              >
                <RotateCcw className="w-3 h-3" />
                Reset to default
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="font-mono text-xs min-h-64 resize-y"
            spellCheck={false}
          />
          {isPromptCustomized && systemPrompt === settings.systemPrompt && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Custom prompt active
            </p>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={handleSave}
          disabled={!hasUnsavedChanges && !saved}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
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
      <Card className="border-destructive/30">
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
