import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FREE_RUN_LIMIT } from "@/lib/free-run-limit";
import { cn } from "@/lib/utils";

export function LandingFooter() {
  return (
    <section className="border-t border-border py-16">
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card px-6 py-10 text-center sm:px-10">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            Check one before you send it.
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{FREE_RUN_LIMIT}</span> free{" "}
            {FREE_RUN_LIMIT === 1 ? "check" : "checks"} on us. After that, attach your own API key
            and run as many as you like — it is stored in your browser and never kept on our
            server.
          </p>
        </div>
        <Link href="/check" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
          Check a résumé — free
        </Link>
      </div>
    </section>
  );
}
