"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
  title: string;
  count?: number;
  quiet?: boolean;
  children: ReactNode;
}

// Panels are always open, unlike Section. The five collapsed drawers they
// replace stacked empty shells at the foot of the page; a group with nothing
// in it is now simply not rendered by the caller.
//
// The fill is deliberately lighter than the verdict card's: the card is the
// only object on the page carrying full weight, and panels reading at the
// same strength is what made the previous layout feel flat.
//
// `quiet` drops the fill entirely and softens the border, for a group that is
// neither a pass nor a failure and must not read as either.
export function Panel({ title, count, quiet = false, children }: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-xl border px-5 py-4",
        quiet ? "border-border/60" : "border-border bg-card/60"
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-base font-medium tracking-tight">{title}</h3>
        {count !== undefined && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
