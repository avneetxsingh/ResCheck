"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HistoryCard } from "./HistoryCard";
import { HistoryEmptyState } from "./HistoryEmptyState";
import { useHistory } from "@/hooks/useHistory";

export function HistoryList() {
  const { history, removeEntry, clearAll } = useHistory();
  const [clearOpen, setClearOpen] = useState(false);

  if (history.length === 0) {
    return <HistoryEmptyState />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {history.length} {history.length === 1 ? "analysis" : "analyses"} saved
        </p>
        <Dialog open={clearOpen} onOpenChange={setClearOpen}>
          <DialogTrigger className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-500 px-2.5 h-7 rounded-lg font-medium transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear history?</DialogTitle>
              <DialogDescription>
                This will permanently delete all {history.length} saved analyses. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClearOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  clearAll();
                  setClearOpen(false);
                }}
              >
                Clear All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {history.map((entry) => (
          <HistoryCard key={entry.id} entry={entry} onRemove={removeEntry} />
        ))}
      </div>
    </div>
  );
}
