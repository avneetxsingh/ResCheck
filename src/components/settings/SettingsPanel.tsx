"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Lock, CheckCircle2, ExternalLink, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSettings } from "@/hooks/useSettings";
import { useHistory } from "@/hooks/useHistory";
import { PROVIDER_INFO as PROVIDERS, PROVIDER_IDS } from "@/lib/providers/catalog";
import type { ProviderId } from "@/lib/providers/catalog";
import { JD_SKILLS_PROMPT, LINE_AUDIT_PROMPT, SUMMARY_PROMPT } from "@/lib/prompts";
import { cn } from "@/lib/utils";

export function SettingsPanel() {
  const { settings, saveSettings, resetAll, hydrated, defaults } = useSettings();
  const { history: entries, clearAll } = useHistory();

  const [provider, setProvider] = useState<ProviderId>(defaults.provider);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // Sync local state when settings hydrate
  useEffect(() => {
    if (hydrated) {
      setProvider(settings.provider);
      setApiKey(settings.apiKeys[settings.provider] ?? "");
      setModel(settings.model);
    }
  }, [hydrated, settings]);

  const active = PROVIDERS[provider];
  const isValidKey = apiKey.startsWith(active.keyPrefix) && apiKey.length > 20;
  const hasUnsavedChanges =
    provider !== settings.provider ||
    apiKey !== (settings.apiKeys[settings.provider] ?? "") ||
    model !== settings.model;

  // Switching provider carries that provider's own key and default model —
  // never the other provider's, which would fail on the first call.
  const handleProviderChange = (next: ProviderId) => {
    setProvider(next);
    setApiKey(settings.apiKeys[next] ?? "");
    setModel(PROVIDERS[next].defaultModel);
  };

  const handleSave = () => {
    saveSettings({
      provider,
      apiKeys: { ...settings.apiKeys, [provider]: apiKey },
      model,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearHistory = () => {
    clearAll();
    setConfirmClearHistory(false);
  };

  const handleResetAll = () => {
    resetAll();
    setProvider(defaults.provider);
    setApiKey("");
    setModel(defaults.model);
    setConfirmResetAll(false);
  };

  if (!hydrated) return null;

  return (
    <div className="space-y-6">
      {/* Provider */}
      <Card className="border-border/50 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Provider</CardTitle>
          <CardDescription>
            Each provider keeps its own key and models. Gemini has far more free
            headroom; Groq is faster per token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {PROVIDER_IDS.map((id) => (
              <label
                key={id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  provider === id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                )}
              >
                <input
                  type="radio"
                  name="provider"
                  value={id}
                  checked={provider === id}
                  onChange={() => handleProviderChange(id)}
                  className="accent-primary"
                />
                <div>
                  <p className="text-sm font-medium">{PROVIDERS[id].label}</p>
                  <p className="text-xs text-muted-foreground">{PROVIDERS[id].keyHint}</p>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Key */}
      <Card className="border-border/50 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            {active.keyLabel}
          </CardTitle>
          <CardDescription>
            Saved to this browser&apos;s localStorage and sent straight to{" "}
            {active.label} with each analysis — there&apos;s no server to store it on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`${active.keyPrefix}...`}
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
              href={active.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              Get a free {active.label} API key
              <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
            </a>
          </p>
        </CardContent>
      </Card>

      {/* Model */}
      <Card className="border-border/50 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Model</CardTitle>
          <CardDescription>
            The default is the fastest; the larger ones catch subtler writing issues.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {active.models.map((m) => (
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
                    className="accent-primary"
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
          <CardTitle className="text-base">Prompts</CardTitle>
          <CardDescription className="mt-1">
            The three prompts the analysis runs on, if you&apos;re curious. They live
            on the server and aren&apos;t editable — scores are computed in code, not
            by the model.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: "JD skill extraction", prompt: JD_SKILLS_PROMPT },
            { name: "Resume writing audit", prompt: LINE_AUDIT_PROMPT },
            { name: "Executive summary", prompt: SUMMARY_PROMPT },
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
              Save
            </>
          )}
        </Button>
        {hasUnsavedChanges && (
          <p className="text-xs text-muted-foreground">Unsaved changes</p>
        )}
      </div>

      {/* Danger zone */}
      <Card className="border-destructive/30 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Clear history */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Clear history</p>
              <p className="text-xs text-muted-foreground">
                {entries.length === 1
                  ? "Deletes the 1 saved analysis. There's no undo."
                  : `Deletes all ${entries.length} saved analyses. There's no undo.`}
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
                Clear history
              </Button>
            )}
          </div>

          <div className="border-t" />

          {/* Reset all */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Reset everything</p>
              <p className="text-xs text-muted-foreground">
                Removes your API key and puts the model back to the default.
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
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
