"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      {/* Background blobs */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          Powered by Groq · llama-3.3-70b-versatile
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl font-bold leading-tight tracking-tight">
          Your Resume,{" "}
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
            Optimized
          </span>{" "}
          for Every Job
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Get an AI-powered ATS score, line-by-line error fixes, and a skills gap analysis
          in seconds — not hours.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/analyze"
            className={cn(buttonVariants({ size: "lg" }), "bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-base px-8")}
          >
            Analyze My Resume
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#how-it-works"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "text-base px-8")}
          >
            See How It Works
          </a>
        </div>

        {/* Trust indicators */}
        <p className="text-xs text-muted-foreground">
          Free to use · Your API key never leaves your browser · No account required
        </p>
      </div>
    </section>
  );
}
