import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeroSection() {
  return (
    <section className="py-24 sm:py-36 text-center">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        <h1 className="text-5xl sm:text-7xl font-semibold tracking-tight text-balance">
          Does your resume pass?
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
          The score an ATS would give it, the lines that hurt it, and the
          skills it&apos;s missing.
        </p>
        <div className="pt-2">
          <Link
            href="/analyze"
            className={cn(buttonVariants({ size: "lg" }), "px-8 text-base gap-2")}
          >
            Analyze my resume
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Free · No account · Nothing stored server-side
        </p>
      </div>
    </section>
  );
}
