import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FREE_RUN_LIMIT } from "@/lib/free-run-limit";
import { cn } from "@/lib/utils";

export function LandingFooter() {
  return (
    <section className="py-16 border-t border-border">
      <h2 className="text-2xl font-semibold tracking-tight text-balance">
        Check one before you send it.
      </h2>
      <p className="mt-2 max-w-prose text-muted-foreground">
        <span className="font-mono tabular-nums text-foreground">{FREE_RUN_LIMIT}</span>{" "}
        free {FREE_RUN_LIMIT === 1 ? "check" : "checks"} on us. After that, attach your own API
        key and run as many as you like — it stays in your browser.
      </p>
      <Link
        href="/check"
        className={cn(buttonVariants({ size: "lg" }), "mt-7 rounded-full px-6")}
      >
        Check a résumé — free
      </Link>
    </section>
  );
}
