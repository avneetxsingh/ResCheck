"use client";

import { CheckCircle2, XCircle, HelpCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { FunnelResult, GateVerdict, ParseVerdict, RetrieveGate } from "@/types/analysis";

interface FunnelPanelProps {
  funnel: FunnelResult;
  // Stable per-ResultsContainer-instance prefix so gate ids stay unique when
  // several history entries are expanded (and therefore several FunnelPanels
  // mounted) at once — GateChips uses the same prefix to target a scroll.
  idPrefix: string;
  // Gate id (see idFor below) to ring-highlight briefly after a chip jump.
  highlightedGateId?: string | null;
}

// Deliberately three states, not two. "unverifiable" must never read as a
// pass — a simulated gate that claims certainty about an answer it cannot see
// is the false precision this funnel replaced. Exported so GateChips renders
// the identical icon/colour for a gate instead of inventing its own mapping.
export const GATE_VERDICT_STYLE: Record<GateVerdict | ParseVerdict, {
  icon: typeof CheckCircle2;
  className: string;
  label: string;
}> = {
  pass: { icon: CheckCircle2, className: "text-green-600 dark:text-green-400", label: "Clears" },
  clean: { icon: CheckCircle2, className: "text-green-600 dark:text-green-400", label: "Clean" },
  risky: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400", label: "Risky" },
  unverifiable: { icon: HelpCircle, className: "text-muted-foreground", label: "Can't be checked here" },
  likely_breaks: { icon: XCircle, className: "text-red-600 dark:text-red-400", label: "Likely breaks" },
  fail: { icon: XCircle, className: "text-red-600 dark:text-red-400", label: "Blocked" },
};

// Gate 3 has no AI/code-authored verdict field — it's derived from the
// surfaced/total counts. Exported so GateChips computes the identical state
// instead of re-deriving (and risking drifting from) this logic.
export function retrieveGateState(retrieve: RetrieveGate): keyof typeof GATE_VERDICT_STYLE {
  if (retrieve.total === 0) return "unverifiable";
  if (retrieve.misses.length === 0) return "pass";
  return retrieve.surfaced * 2 < retrieve.total ? "fail" : "risky";
}

export function idFor(idPrefix: string, gate: "parse" | "knockout" | "retrieve") {
  return `${idPrefix}-gate-${gate}`;
}

interface GateProps {
  id: string;
  step: string;
  title: string;
  state: keyof typeof GATE_VERDICT_STYLE;
  summary: string;
  highlighted?: boolean;
  children?: ReactNode;
}

function Gate({ id, step, title, state, summary, highlighted, children }: GateProps) {
  const style = GATE_VERDICT_STYLE[state];
  const Icon = style.icon;
  return (
    <div
      id={id}
      className={cn(
        "px-4 py-4 motion-safe:transition-shadow motion-safe:duration-700 motion-safe:ease-out",
        highlighted && "ring-2 ring-inset ring-ring/70"
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", style.className)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {step}. {title}
            <span className={cn("ml-2 font-normal", style.className)}>{style.label}</span>
          </p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{summary}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function FunnelPanel({ funnel, idPrefix, highlightedGateId }: FunnelPanelProps) {
  const { parse, knockout, retrieve, signals } = funnel;
  const requiredChecks = knockout.checks.filter((c) => c.required);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/50 divide-y divide-border/50 overflow-hidden">
        <Gate
          id={idFor(idPrefix, "parse")}
          highlighted={highlightedGateId === idFor(idPrefix, "parse")}
          step="1"
          title="Parse"
          state={parse.verdict}
          summary={
            parse.verdict === "clean"
              ? "An ATS can read every section of this document."
              : "Extraction found problems that can cost content before a human ever reads it."
          }
        >
          {parse.reasons.length > 0 && (
            <ul className="mt-2 space-y-1">
              {parse.reasons.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground">{r}</li>
              ))}
            </ul>
          )}
        </Gate>

        <Gate
          id={idFor(idPrefix, "knockout")}
          highlighted={highlightedGateId === idFor(idPrefix, "knockout")}
          step="2"
          title="Knockout"
          state={knockout.stated ? knockout.verdict : "unverifiable"}
          summary={
            knockout.stated
              ? "The only true auto-rejection in a real ATS. These fire on the application form's answers, so ResCheck can only simulate them."
              : "The posting states no hard requirements, so nothing was checked here."
          }
        >
          {knockout.checks.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {knockout.checks.map((c, i) => {
                const style = GATE_VERDICT_STYLE[c.verdict];
                return (
                  <li key={i} className="text-xs flex gap-2">
                    <span className={cn("shrink-0 font-medium", style.className)}>{style.label}</span>
                    <span className="text-muted-foreground">
                      {c.value}
                      {!c.required && " (preferred, not a knockout)"} — {c.detail}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {requiredChecks.some(
            (c) => (c.type === "work_authorization" || c.type === "location") && c.verdict === "unverifiable"
          ) && (
            <p className="text-xs text-muted-foreground mt-2">
              A resume never states work authorization or location, and ResCheck never sees the
              application form. Those are yours to confirm — not a pass and not a failure.
            </p>
          )}
        </Gate>

        <Gate
          id={idFor(idPrefix, "retrieve")}
          highlighted={highlightedGateId === idFor(idPrefix, "retrieve")}
          step="3"
          title="Retrieve"
          state={retrieveGateState(retrieve)}
          summary={
            retrieve.total === 0
              ? "No requirements came out of this posting, so no searches could be run."
              : `Your resume surfaces for ${retrieve.surfaced} of ${retrieve.total} searches a recruiter would plausibly run against this posting.`
          }
        >
          {retrieve.misses.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Misses: {retrieve.misses.join(", ")}
            </p>
          )}
        </Gate>
      </div>

      {signals.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">How you sort</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Nothing here is a rejection, and these are deliberately not combined into a score —
            ResCheck has no other applicants to rank you against.
          </p>
          <div className="mt-3 rounded-xl border border-border/50 divide-y divide-border/50 overflow-hidden">
            {signals.map((s) => (
              <div key={s.key} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm">{s.label}</span>
                  <span className="text-sm font-medium tabular-nums shrink-0">{s.value}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
