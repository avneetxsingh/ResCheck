"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * One toggle, used by both headers. It was previously inlined in the workspace
 * only, which left the landing page with no way to change theme at all.
 *
 * The `mounted` guard is not optional: the server cannot know the visitor's
 * resolved theme, so rendering the real icon before hydration prints whichever
 * one the server guessed and then swaps it. A fixed-size placeholder keeps the
 * header from reflowing when the real button arrives.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="size-9" aria-hidden />;

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
