"use client";

import type { KnockoutGate, ParseGate, RetrieveGate } from "@/types/analysis";
import { cn } from "@/lib/utils";
import { TONE_CLASS, type Tone } from "./FindingRow";

interface GateCellsProps {
  parse: ParseGate;
  // null means this gate has not been computed yet — it depends on the slow
  // stage. It renders as visibly still-resolving, never as a value.
  knockout: KnockoutGate | null;
  retrieve: RetrieveGate;
}

const PARSE_TONE: Record<string, Tone> = {
  clean: "pass",
  risky: "warn",
  likely_breaks: "fail",
};

const VERDICT_TONE: Record<string, Tone> = {
  pass: "pass",
  fail: "fail",
  unverifiable: "unknown",
};

// Gate 3 has no authored verdict field — it is derived from the counts.
// Carried across from FunnelPanel.retrieveGateState so the two cannot drift.
export function retrieveTone(retrieve: RetrieveGate): Tone {
  if (retrieve.total === 0) return "unknown";
  if (retrieve.misses.length === 0) return "pass";
  return retrieve.surfaced * 2 < retrieve.total ? "fail" : "warn";
}

interface CellProps {
  label: string;
  value: string;
  tone: Tone;
  pending?: boolean;
}

function Cell({ label, value, tone, pending = false }: CellProps) {
  return (
    <div className="border border-border rounded-lg px-3 py-2.5 bg-muted/40">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-sm font-semibold mt-1",
          pending ? "text-muted-foreground" : TONE_CLASS[tone]
        )}
      >
        {pending ? <span className="opacity-70">checking…</span> : value}
      </div>
    </div>
  );
}

export function GateCells({ parse, knockout, retrieve }: GateCellsProps) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Cell
        label="Parse"
        tone={PARSE_TONE[parse.verdict] ?? "unknown"}
        value={
          parse.verdict === "clean" ? "Clean"
            : parse.verdict === "risky" ? "Risky"
              : "Likely breaks"
        }
      />
      <Cell
        label="Knockout"
        pending={knockout === null}
        tone={
          knockout === null ? "unknown"
            : knockout.stated ? (VERDICT_TONE[knockout.verdict] ?? "unknown") : "unknown"
        }
        value={
          knockout === null ? ""
            : !knockout.stated ? "Not stated"
              : knockout.verdict === "pass" ? "Clears"
                : knockout.verdict === "fail" ? "Blocked"
                  : "Check yourself"
        }
      />
      <Cell
        label="Retrieve"
        tone={retrieveTone(retrieve)}
        value={retrieve.total === 0 ? "No searches" : `${retrieve.surfaced} / ${retrieve.total}`}
      />
    </div>
  );
}
