"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Trash2, X } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/types/history";

interface HistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: HistoryEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

// DialogContent bakes in centered-modal positioning (top-1/2 left-1/2, zoom
// animation) that a side sheet would have to fight class-by-class. The Root,
// Portal and Overlay are generic, so this composes them with its own Popup
// instead of reusing DialogContent — same primitive, no fixed-position div.
export function HistoryPanel({ open, onOpenChange, entries, activeId, onSelect, onRemove }: HistoryPanelProps) {
  const selectAndClose = (id: string) => {
    onSelect(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="history-panel"
          className="fixed inset-y-0 right-0 z-50 flex h-full w-[380px] max-w-[calc(100%-2rem)] flex-col gap-0 border-l border-border bg-popover text-popover-foreground shadow-lg outline-none duration-150 data-open:animate-in data-open:slide-in-from-right data-open:fade-in-0 data-closed:animate-out data-closed:slide-out-to-right data-closed:fade-out-0"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <DialogTitle>Past runs</DialogTitle>
            <DialogClose
              aria-label="Close history"
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <X className="w-4 h-4" />
            </DialogClose>
          </div>

          <div className="flex-1 overflow-y-auto">
            {entries.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">No past runs yet.</p>
            ) : (
              <ul>
                {entries.map((entry) => (
                  // Two sibling controls, never one nested inside the other:
                  // a control inside a control is not reliably reachable by
                  // assistive technology, and the inner one here deletes data.
                  <li
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 transition-colors",
                      activeId === entry.id ? "bg-muted/60" : "hover:bg-muted/30"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectAndClose(entry.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">{entry.job_title_hint}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {typeof entry.overall_score === "number" && (
                        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                          {entry.overall_score}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(entry.id)}
                      aria-label={`Delete run: ${entry.job_title_hint}`}
                      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-state-fail"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
