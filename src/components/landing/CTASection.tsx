import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CTASection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-10 sm:p-14 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready to land the interview?
          </h2>
          <p className="text-indigo-100 text-lg max-w-xl mx-auto">
            Upload your resume now and find out exactly what&apos;s holding you back.
          </p>
          <Link
            href="/analyze"
            className={cn(buttonVariants({ size: "lg" }), "bg-white text-indigo-700 hover:bg-indigo-50 gap-2 text-base px-8 font-semibold")}
          >
            Analyze My Resume Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-indigo-200">
            Free · No sign-up · Your data stays private
          </p>
        </div>
      </div>
    </section>
  );
}
