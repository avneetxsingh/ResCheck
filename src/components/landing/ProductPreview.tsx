"use client";

import { CheckRing } from "@/components/results/CheckRing";
import { GateCells } from "@/components/results/GateCells";
import { AtsDimensions } from "@/components/results/AtsDimensions";
import type { AtsDimension } from "@/lib/ats-dimensions";
import type { KnockoutGate, ParseGate, RetrieveGate } from "@/types/analysis";

/**
 * The hero's product shot, built from the report's own components rather than
 * drawn as a picture of them. A mock-up drifts from the product the first time
 * either changes; this cannot, because it IS the product with example values.
 *
 * Every figure below is illustrative and the frame says so. They are the shape
 * of a real result — counts with denominators, and a gate that says "check
 * yourself" because a résumé cannot state work authorisation — rather than a
 * flattering number invented for a marketing page.
 */

const PARSE: ParseGate = { verdict: "clean", reasons: [] };

const KNOCKOUT: KnockoutGate = {
  verdict: "unverifiable",
  stated: true,
  checks: [
    {
      type: "work_authorization",
      value: "Authorized to work in the US",
      required: true,
      verdict: "unverifiable",
      detail: "A résumé does not state this; the application form will ask.",
    },
  ],
};

const RETRIEVE: RetrieveGate = { queries: [], surfaced: 9, total: 9, misses: [] };

const DIMENSIONS: AtsDimension[] = [
  { key: "retrieve", label: "Searches", present: 9, total: 9, ratio: 1, detail: "" },
  { key: "must_have", label: "Must-haves", present: 6, total: 6, ratio: 1, detail: "" },
  { key: "requirements", label: "Requirements", present: 2, total: 2, ratio: 1, detail: "" },
  { key: "sections", label: "Sections", present: 5, total: 5, ratio: 1, detail: "" },
  { key: "nice_to_have", label: "Nice-to-haves", present: 3, total: 7, ratio: 3 / 7, detail: "" },
];

const TALLY = { passed: 25, total: 29, unmeasured: [] as string[] };

export function ProductPreview() {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Window chrome, so the frame reads as a screen rather than a diagram. */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-state-fail/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-state-warn/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-state-pass/50" />
        </span>
        <figcaption className="ml-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Example report — not your résumé
        </figcaption>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="scale-90">
            <CheckRing tally={TALLY} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Screening outcome
            </p>
            <p className="mt-0.5 font-mono text-2xl font-semibold tracking-tight text-state-warn">
              Moderate
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Parses cleanly, meets every requirement that can be checked, and surfaces for all
              nine searches.
            </p>
          </div>
        </div>

        <GateCells parse={PARSE} knockout={KNOCKOUT} retrieve={RETRIEVE} />

        <div className="rounded-lg border border-border px-4 py-3">
          <p className="text-xs font-medium">ATS dimensions</p>
          {/* Bounded: at full card width the chart alone runs past 300px tall
              and the preview towers over the copy beside it. */}
          <div className="mx-auto mt-2 max-w-[300px]">
            <AtsDimensions dimensions={DIMENSIONS} />
          </div>
        </div>
      </div>
    </figure>
  );
}
