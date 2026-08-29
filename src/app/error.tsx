"use client";

import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Before this existed, one malformed saved run unmounted the whole page and
// left a blank screen with no way back — and because the record persists in
// localStorage, it broke again on every visit.
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[render]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-medium">Something broke while drawing that.</h1>
      {/* The message is deliberately not rendered: it can quote lines from the
          user's own résumé, and it is not actionable to them. It goes to the
          console for whoever is debugging. */}
      <p className="text-sm text-muted-foreground">
        Your résumé was not sent anywhere, and nothing about it was kept. A saved run may be
        malformed — clearing them fixes it and costs you only the run history.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-5")}
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem("rescheck_history");
            } catch {
              // Storage blocked; the reload below is still worth attempting.
            }
            window.location.assign("/check");
          }}
          className={cn(buttonVariants(), "rounded-full px-5")}
        >
          Clear saved runs and reload
        </button>
      </div>
    </div>
  );
}
