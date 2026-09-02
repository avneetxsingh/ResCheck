import Link from "next/link";
import { Sparkles, Lock, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";
import { ProductPreview } from "./ProductPreview";
import { FREE_RUN_LIMIT } from "@/lib/free-run-limit";
import { cn } from "@/lib/utils";

// The headline states what the product does, not what it will get you. An
// outcome promise here would be the first lie on a page whose entire pitch is
// that it does not make things up.
export function Hero() {
  return (
    <section className="grid items-start gap-10 pt-10 pb-16 lg:grid-cols-2 lg:gap-12 lg:pt-16 lg:pb-20">
      <div>
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent px-3 py-1 text-xs text-accent-foreground">
            <Sparkles className="h-3 w-3" aria-hidden />
            AI reads the documents. Code decides.
          </span>
        </Reveal>

        <Reveal delay={60}>
          <h1 className="mt-5 max-w-[18ch] text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl">
            Know what screening does to your résumé{" "}
            <span className="text-muted-foreground">before a recruiter sees it.</span>
          </h1>
        </Reveal>

        <Reveal delay={100}>
          <p className="mt-5 max-w-prose text-base leading-relaxed text-muted-foreground sm:text-lg">
            Most tools invent a score. This one computes three things it can actually check —
            whether your document parses, whether it meets the requirements the posting states,
            and whether a recruiter&apos;s search would surface you — and says plainly when it
            cannot know.
          </p>
        </Reveal>

        <Reveal delay={140}>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/check"
              className={cn(buttonVariants({ size: "lg" }), "group rounded-full px-6")}
            >
              Check a résumé — free
              <ArrowRight className="ml-1.5 size-4 transition-transform duration-[var(--dur-fast)] ease-[var(--ease-settle)] group-hover:translate-x-0.5" />
            </Link>
            {/* Anchors the real sample further down the page rather than a demo
                video we do not have. */}
            <a
              href="#sample"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "rounded-full px-6"
              )}
            >
              See a sample report
            </a>
          </div>
        </Reveal>

        <Reveal delay={180}>
          <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-mono tabular-nums text-foreground">{FREE_RUN_LIMIT}</span> free{" "}
              {FREE_RUN_LIMIT === 1 ? "check" : "checks"}, no account, no copy of your résumé kept.
            </span>
          </p>
        </Reveal>
      </div>

      <Reveal delay={120}>
        <ProductPreview />
      </Reveal>
    </section>
  );
}
