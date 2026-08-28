import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";
import { FREE_RUN_LIMIT } from "@/lib/free-run-limit";
import { cn } from "@/lib/utils";

// The headline states what the product does, not what it will get you. An
// outcome promise here would be the first lie on a page whose entire pitch is
// that it does not make things up.
export function Hero() {
  return (
    <section className="pt-20 pb-16 sm:pt-28 sm:pb-20">
      <Reveal>
        <h1 className="max-w-[18ch] text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] text-balance">
          Find out what screening actually does to your résumé.
        </h1>
      </Reveal>
      <Reveal delay={60}>
        <p className="mt-5 max-w-prose text-base sm:text-lg text-muted-foreground leading-relaxed">
          Most tools invent a score. This one computes three things it can prove — whether your
          document parses, whether it meets the requirements the posting actually states, and
          whether a recruiter&apos;s search would surface you — and says plainly when it
          cannot know.
        </p>
      </Reveal>
      <Reveal delay={120}>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/check" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
            Check a résumé — free
          </Link>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{FREE_RUN_LIMIT}</span>{" "}
            free {FREE_RUN_LIMIT === 1 ? "check" : "checks"}, no account, nothing kept.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
