"use client";

import { useState } from "react";
import { ArrowRight, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";
import { ResultsView } from "@/components/results/ResultsView";
import { SAMPLE_RESULT } from "@/lib/sample-result";
import { buildAtsDimensions, summariseChecks } from "@/lib/ats-dimensions";
import { OUTCOMES, OFFER_ITEMS } from "@/lib/offer";
import { cn } from "@/lib/utils";

// Derived here, never typed: these are the same functions the product runs, so
// the headline figures on this page are a property of SAMPLE_RESULT rather than
// numbers someone chose. Change the sample and the page follows.
const DIMENSIONS = buildAtsDimensions(SAMPLE_RESULT);
const TALLY = summariseChecks(DIMENSIONS);
const PCT = Math.round((TALLY.passed / TALLY.total) * 100);

const SKILLS = [...SAMPLE_RESULT.skills_gap.must_have, ...SAMPLE_RESULT.skills_gap.nice_to_have];
const FOUND = SKILLS.filter((s) => s.present_in_resume).length;
const MISSING = SKILLS.length - FOUND;

const RETRIEVE = SAMPLE_RESULT.funnel.retrieve;
const PARSE = SAMPLE_RESULT.funnel.parse;

const HIGHLIGHTS: { label: string; value: string; sub: string; tone: string }[] = [
  {
    label: "Checks passed",
    value: `${PCT}%`,
    sub: `${TALLY.passed} of ${TALLY.total}`,
    tone: "text-state-warn",
  },
  {
    label: "Parses cleanly",
    value: PARSE.verdict === "clean" ? "Clean" : "Risky",
    sub: "machine-readable",
    tone: PARSE.verdict === "clean" ? "text-state-pass" : "text-state-warn",
  },
  {
    label: "Skills found",
    value: `${FOUND}/${SKILLS.length}`,
    sub: "named by the posting",
    tone: "text-state-pass",
  },
  {
    label: "Skills missing",
    value: String(MISSING),
    sub: "absent from your résumé",
    tone: "text-state-fail",
  },
  {
    label: "Recruiter searches",
    value: `${RETRIEVE.surfaced}/${RETRIEVE.total}`,
    sub: "surface your résumé",
    tone: "text-state-pass",
  },
];

// One line rather than a card per feature. It still comes from OFFER_ITEMS, so
// a report that does not exist yet cannot be described in the present tense.
const BUILT = OFFER_ITEMS.filter((i) => i.available).map((i) => i.name);
const PENDING = OFFER_ITEMS.filter((i) => !i.available).map((i) => i.name);

export function AnalysisPreview() {
  const [open, setOpen] = useState(false);

  return (
    <section id="sample" className="scroll-mt-8 border-t border-border py-16">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight">What you&apos;ll actually get</h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          A real report on an example résumé — the same one you can open in full below. Every
          figure is a count this tool produced from that document, not a rating of the person.
        </p>
      </Reveal>

      <Reveal delay={60}>
        <div className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Example report — not your résumé
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {HIGHLIGHTS.map((h) => (
              <div key={h.label} className="rounded-xl border border-border px-4 py-3.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {h.label}
                </p>
                <p className={cn("mt-1.5 font-mono text-2xl font-semibold tabular-nums", h.tone)}>
                  {h.value}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{h.sub}</p>
              </div>
            ))}
          </div>

          {/* The payoff is the instruction, not the number beside it. */}
          <div className="mt-4 flex gap-3 rounded-xl border border-border bg-accent/40 px-4 py-3.5">
            <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                The first thing to fix
              </p>
              <p className="mt-1 text-sm leading-relaxed">
                {SAMPLE_RESULT.summary.top_improvements[0]}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant={open ? "outline" : "default"}
              className="group rounded-full px-5"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="sample-report"
            >
              {open ? "Hide the full report" : "View the full sample report"}
              {!open && (
                <ArrowRight className="ml-1.5 size-4 transition-transform duration-[var(--dur-fast)] ease-[var(--ease-settle)] group-hover:translate-x-0.5" />
              )}
            </Button>
            <p className="text-xs text-muted-foreground">No upload, no key, nothing to sign.</p>
          </div>

          {open && (
            <Reveal>
              <div id="sample-report" className="mt-6 border-t border-border pt-6">
                <ResultsView
                  result={SAMPLE_RESULT}
                  partial={null}
                  onReset={() => setOpen(false)}
                  showActions={false}
                />
              </div>
            </Reveal>
          )}
        </div>
      </Reveal>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Every report includes {BUILT.join(", ")}.
        {PENDING.length > 0 && (
          <>
            {" "}
            {PENDING.join(" and ")} {PENDING.length === 1 ? "is" : "are"} still being built and{" "}
            {PENDING.length === 1 ? "is" : "are"} not in it yet.
          </>
        )}
      </p>

      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {OUTCOMES.map((o, i) => (
          <Reveal key={o.name} delay={100 + i * 50}>
            <li>
              <h3 className="text-sm font-medium tracking-tight">{o.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{o.body}</p>
            </li>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
