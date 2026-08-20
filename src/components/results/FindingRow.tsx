"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "fail" | "warn" | "pass" | "unknown";

// "unknown" is deliberately grey and never amber: an unverifiable check must
// not read as a near-miss. This mapping is the single place that decides it.
export const TONE_CLASS: Record<Tone, string> = {
  fail: "text-state-fail",
  warn: "text-state-warn",
  pass: "text-state-pass",
  unknown: "text-state-unknown",
};

interface FindingRowProps {
  tag: string;
  tone: Tone;
  children: ReactNode;
  meta?: ReactNode;
}

export function FindingRow({ tag, tone, children, meta }: FindingRowProps) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-border/60 last:border-b-0">
      <span
        className={cn(
          "font-mono text-[10px] font-semibold tracking-wider uppercase w-12 shrink-0 pt-0.5",
          TONE_CLASS[tone]
        )}
      >
        {tag}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-relaxed">{children}</div>
        {meta && <div className="text-xs text-muted-foreground mt-1">{meta}</div>}
      </div>
    </div>
  );
}
