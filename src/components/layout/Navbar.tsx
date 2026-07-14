"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, Settings } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/60 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex h-14 items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight text-[15px]">
          ResCheck
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/analyze" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Analyze
          </Link>
          <Link href="/history" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            History
          </Link>
          <Link href="/settings" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "ml-0.5")} aria-label="Settings">
            <Settings className="w-4 h-4" />
          </Link>

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-1"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
