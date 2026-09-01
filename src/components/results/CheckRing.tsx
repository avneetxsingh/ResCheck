"use client";

import { cn } from "@/lib/utils";
import type { CheckTally } from "@/lib/ats-dimensions";

interface CheckRingProps {
  tally: CheckTally;
}

const SIZE = 132;
const STROKE = 9;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * The headline figure. It is a count of discrete checks the app ran — not the
 * `overall_ats_score` deleted in sub-project C, which blended invented
 * sub-scores. The percentage is only ever `passed / total` rendered a second
 * way, and the fraction it came from is printed directly beneath it so the
 * number can never travel without its provenance.
 *
 * Checks nobody could run are excluded from both sides and named underneath,
 * rather than being counted as failures.
 */
export function CheckRing({ tally }: CheckRingProps) {
  const { passed, total, unmeasured } = tally;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 text-center">
        <div
          className="flex items-center justify-center rounded-full border-[9px] border-border text-muted-foreground"
          style={{ width: SIZE, height: SIZE }}
        >
          <span className="font-mono text-sm">n/a</span>
        </div>
        <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
          Nothing could be checked for this run, so there is no figure to show.
        </p>
      </div>
    );
  }

  const ratio = passed / total;
  const pct = Math.round(ratio * 100);
  const tone =
    ratio === 1 ? "text-state-pass" : ratio >= 0.6 ? "text-state-warn" : "text-state-fail";
  const stroke =
    ratio === 1 ? "stroke-state-pass" : ratio >= 0.6 ? "stroke-state-warn" : "stroke-state-fail";

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            className="fill-none stroke-border"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            className={cn("fill-none", stroke)}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-mono text-3xl font-semibold tabular-nums", tone)}>{pct}%</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {passed}/{total}
          </span>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">Checks passed</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {passed} of {total} {total === 1 ? "check" : "checks"} this résumé was put through
        </p>
        {unmeasured.length > 0 && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {unmeasured.join(", ")} could not be checked, and{" "}
            {unmeasured.length === 1 ? "is" : "are"} in neither number.
          </p>
        )}
      </div>
    </div>
  );
}
