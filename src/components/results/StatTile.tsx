"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  /** The figure itself. Mono and tabular so a row of tiles aligns. */
  value: string;
  /** One short qualifier under the value — a state word or a list. */
  detail?: string;
  tone?: "pass" | "warn" | "fail" | "neutral" | "unknown";
}

const TONE: Record<string, string> = {
  pass: "text-state-pass",
  warn: "text-state-warn",
  fail: "text-state-fail",
  unknown: "text-state-unknown",
  neutral: "text-foreground",
};

export function StatTile({ icon: Icon, label, value, detail, tone = "neutral" }: StatTileProps) {
  return (
    <div className="rounded-lg border border-border bg-card px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent">
          <Icon className="h-3.5 w-3.5 text-accent-foreground" aria-hidden />
        </span>
        <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className={cn("mt-1.5 font-mono text-xl font-semibold tabular-nums", TONE[tone])}>
        {value}
      </p>
      {detail && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={detail}>
          {detail}
        </p>
      )}
    </div>
  );
}
