"use client";

import { useEffect, useRef, useState } from "react";
import { ScoreRing } from "@/components/results/ScoreRing";

const METRICS = [
  { label: "ATS Score", score: 78, color: "text-amber-500" },
  { label: "Skills Match", score: 65, color: "text-amber-500" },
  { label: "Grammar", score: 91, color: "text-green-500" },
  { label: "Impact", score: 58, color: "text-red-500" },
  { label: "Keywords", score: 72, color: "text-amber-500" },
];

export function SampleScorecard() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold">See what your report looks like</h2>
          <p className="text-muted-foreground mt-3">
            A real-time scorecard with actionable scores across 5 dimensions
          </p>
        </div>

        <div
          ref={ref}
          className="rounded-2xl border bg-card p-8 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* Overall ring */}
            <div className="shrink-0">
              <ScoreRing score={visible ? 78 : 0} size="lg" label="Overall ATS" animate={visible} />
            </div>

            {/* Metrics grid */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-6">
              {METRICS.slice(1).map((m) => (
                <div key={m.label} className="flex flex-col items-center gap-1">
                  <ScoreRing score={visible ? m.score : 0} size="sm" animate={visible} />
                  <span className="text-xs text-muted-foreground mt-1">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sample error */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">
              Sample Error
            </p>
            <div className="rounded-lg border-l-4 border-l-amber-500 border bg-card p-3 space-y-2">
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">moderate</span>
                <span className="text-xs border rounded px-2 py-0.5">Weak Verb</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-red-500/5 border border-red-500/20 p-2">
                  <span className="text-red-500 line-through">Worked on</span> a team to build microservices
                </div>
                <div className="rounded bg-green-500/5 border border-green-500/20 p-2">
                  <span className="text-green-600 font-medium">Led</span> a team to build microservices
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
