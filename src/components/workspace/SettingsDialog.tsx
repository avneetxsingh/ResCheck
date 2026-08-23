"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { AppSettings } from "@/hooks/useSettings";
import { PROVIDER_INFO as PROVIDERS, PROVIDER_IDS } from "@/lib/providers/catalog";
import type { ProviderId } from "@/lib/providers/catalog";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
  saveSettings: (updated: Partial<AppSettings>) => void;
  hydrated: boolean;
  defaults: AppSettings;
}

export function SettingsDialog({
  open, onOpenChange, settings, saveSettings, hydrated, defaults,
}: SettingsDialogProps) {
  const [provider, setProvider] = useState<ProviderId>(defaults.provider);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [showKey, setShowKey] = useState(false);

  // Local state persists between opens because the dialog never unmounts, so
  // a cancelled edit would still be sitting there on the next open — and
  // saving it could switch the active provider to one with no key. Re-sync
  // from the real settings every time the dialog opens.
  useEffect(() => {
    if (!open || !hydrated) return;
    setProvider(settings.provider);
    setApiKey(settings.apiKeys[settings.provider] ?? "");
    setModel(settings.model);
  }, [open, hydrated, settings]);

  const active = PROVIDERS[provider];
  const isValidKey = apiKey.startsWith(active.keyPrefix) && apiKey.length > 20;

  // Switching provider carries that provider's own key and default model —
  // never the other provider's, which would fail on the first call.
  const handleProviderChange = (next: ProviderId) => {
    setProvider(next);
    setApiKey(settings.apiKeys[next] ?? "");
    setModel(PROVIDERS[next].defaultModel);
  };

  const handleSave = () => {
    saveSettings({ provider, apiKeys: { ...settings.apiKeys, [provider]: apiKey }, model });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Your key is stored in this browser and sent only with your own analyses.
            Nothing is kept on a server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Provider
            </p>
            <div className="grid gap-2">
              {PROVIDER_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleProviderChange(id)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    provider === id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  )}
                >
                  <span>{PROVIDERS[id].label}</span>
                  {provider === id && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {active.keyLabel}
            </p>
            <div className="flex gap-2">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`${active.keyPrefix}…`}
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <a
              href={active.keyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Get a key <ExternalLink className="w-3 h-3" />
            </a>
            {apiKey.length > 0 && !isValidKey && (
              <p className="text-xs text-state-warn">
                That doesn&apos;t look like a {active.label} key — it starts with{" "}
                <span className="font-mono">{active.keyPrefix}</span>.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Model
            </p>
            <div className="grid gap-2">
              {active.models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModel(m.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    model === m.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  )}
                >
                  <span className="font-mono text-sm">{m.label}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{m.note}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
