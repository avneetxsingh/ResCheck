"use client";

import { cn } from "@/lib/utils";
import { GATE_VERDICT_STYLE, retrieveGateState, idFor } from "./FunnelPanel";
import type { FunnelResult, KnockoutGate, ParseVerdict, RetrieveGate } from "@/types/analysis";

interface GateChipsProps {
  funnel: FunnelResult;
  // Same prefix FunnelPanel used to build its gate ids — keeps a click here
  // scrolling to the matching gate even when several ResultsContainers (e.g.
  // multiple expanded history cards) are mounted at once.
  idPrefix: string;
  onSelectGate: (gateId: string) => void;
}

// Short chip-sized copy. Same honesty rule as the full gate: "unverifiable"
// / "not stated" must never read as a pass.
function parseChipText(verdict: ParseVerdict): string {
  if (verdict === "clean") return "Parses";
  if (verdict === "risky") return "Parse — risky";
  return "Parse — breaks";
}

function knockoutChipText(knockout: KnockoutGate): string {
  if (!knockout.stated) return "Knockout — not stated";
  if (knockout.verdict === "pass") return "Knockout — clears";
  if (knockout.verdict === "fail") return "Knockout — blocked";
  return "Knockout — unverifiable";
}

function retrieveChipText(retrieve: RetrieveGate): string {
  // "0 of 0" would misread as a fresh failure rather than "no requirements
  // to search for" — say so in words instead.
  if (retrieve.total === 0) return "No searches";
  return `${retrieve.surfaced} of ${retrieve.total} searches`;
}

export function GateChips({ funnel, idPrefix, onSelectGate }: GateChipsProps) {
  const { parse, knockout, retrieve } = funnel;
  const knockoutState = knockout.stated ? knockout.verdict : "unverifiable";
  const retrieveState = retrieveGateState(retrieve);

  const chips = [
    {
      id: idFor(idPrefix, "parse"),
      icon: GATE_VERDICT_STYLE[parse.verdict].icon,
      className: GATE_VERDICT_STYLE[parse.verdict].className,
      text: parseChipText(parse.verdict),
      aria: `Gate 1, Parse: ${GATE_VERDICT_STYLE[parse.verdict].label}. Jump to this gate.`,
    },
    {
      id: idFor(idPrefix, "knockout"),
      icon: GATE_VERDICT_STYLE[knockoutState].icon,
      className: GATE_VERDICT_STYLE[knockoutState].className,
      text: knockoutChipText(knockout),
      aria: `Gate 2, Knockout: ${
        knockout.stated ? GATE_VERDICT_STYLE[knockout.verdict].label : "not stated, nothing was checked"
      }. Jump to this gate.`,
    },
    {
      id: idFor(idPrefix, "retrieve"),
      icon: GATE_VERDICT_STYLE[retrieveState].icon,
      className: GATE_VERDICT_STYLE[retrieveState].className,
      text: retrieveChipText(retrieve),
      aria: `Gate 3, Retrieve: ${retrieveChipText(retrieve)}. Jump to this gate.`,
    },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {chips.map((chip) => {
        const Icon = chip.icon;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSelectGate(chip.id)}
            aria-label={chip.aria}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/50 text-xs font-medium",
              "hover:bg-muted/50 transition-colors cursor-pointer",
              "focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            )}
          >
            <Icon className={cn("w-3.5 h-3.5 shrink-0", chip.className)} aria-hidden />
            <span className={chip.className}>{chip.text}</span>
          </button>
        );
      })}
    </div>
  );
}
