"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Section({ title, count, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="py-4 border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 text-left"
      >
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground shrink-0 motion-safe:transition-transform",
            !open && "-rotate-90"
          )}
          aria-hidden
        />
        <h3 className="flex-1 text-sm font-medium tracking-tight">
          {title}
        </h3>
        {count !== undefined && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{count}</span>
        )}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </section>
  );
}
