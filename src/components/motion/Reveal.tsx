"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  /** Milliseconds to wait before this item arrives. Stagger siblings by ~60ms. */
  delay?: number;
  className?: string;
}

// Deliberately CSS-only. The duration tokens already collapse under
// prefers-reduced-motion, so there is no JS branch to keep in sync and no
// hydration mismatch risk from reading a media query during render.
export function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    <div
      className={cn("reveal-item", className)}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
