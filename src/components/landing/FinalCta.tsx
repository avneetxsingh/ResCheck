import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";
import { FREE_RUN_LIMIT } from "@/lib/free-run-limit";
import { cn } from "@/lib/utils";

// Deliberately almost empty. One sentence, one button, and a great deal of room
// around them — anything else placed here competes with the only thing this
// section is for.
export function FinalCta() {
  return (
    <section className="border-t border-border py-28 sm:py-36">
      <Reveal>
        <h2 className="mx-auto max-w-[20ch] text-center text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl">
          Before you apply, know what they&apos;ll see.
        </h2>
      </Reveal>
      <Reveal delay={80}>
        <div className="mt-10 flex justify-center">
          <Link
            href="/check"
            className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8 text-base")}
          >
            Check my résumé
          </Link>
        </div>
      </Reveal>
      <Reveal delay={140}>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">{FREE_RUN_LIMIT}</span> free{" "}
          {FREE_RUN_LIMIT === 1 ? "check" : "checks"}, no account.
        </p>
      </Reveal>
    </section>
  );
}
