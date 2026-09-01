"use client";

import { useRef, useState } from "react";
import {
  RotateCcw,
  AlertTriangle,
  LayoutList,
  AtSign,
  Type,
  ListChecks,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GateCells } from "./GateCells";
import { FindingRow } from "./FindingRow";
import { StatTile } from "./StatTile";
import { AtsDimensions } from "./AtsDimensions";
import { SkillBadge } from "./SkillBadge";
import { ErrorReportPanel } from "./ErrorReportPanel";
import { FormattingAuditPanel } from "./FormattingAuditPanel";
import { SkillsGapPanel } from "./SkillsGapPanel";
import { AmbushKitPanel } from "./AmbushKitPanel";
import { SummaryPanel } from "./SummaryPanel";
import { ExportButton } from "./ExportButton";
import { LegacyResultsView } from "./LegacyResultsView";
import { buildAtsDimensions } from "@/lib/ats-dimensions";
import type { AnalysisResult } from "@/types/analysis";
import type { PartialAnalysis } from "@/types/api";
import { Reveal } from "@/components/motion/Reveal";
import { PendingPanel } from "./PendingPanel";

interface ResultsViewProps {
  // null while a run is still in flight and only the early gates exist.
  result: AnalysisResult | null;
  // The two gates that are final as soon as AI-1 lands, ~18s before the rest.
  partial: PartialAnalysis | null;
  onReset: () => void;
}

const VERDICT_CLASS: Record<string, string> = {
  strong: "text-state-pass",
  moderate: "text-state-warn",
  needs_work: "text-state-warn",
  critical: "text-state-fail",
};

const VERDICT_LABEL: Record<string, string> = {
  strong: "Strong",
  moderate: "Moderate",
  needs_work: "Needs work",
  critical: "Critical",
};

type TabKey = "questions" | "writing" | "sort" | "ats" | "skills" | "summary";

export function ResultsView({ result, partial, onReset }: ResultsViewProps) {
  // Hooks must run in the same order on every render, so these stay above the
  // legacy early return — switching between a pre-funnel and a funnel-shaped
  // past run reuses this same mounted component.
  const printRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabKey>("questions");

  // Pre-funnel entries have no gates to rank. They get their own view rather
  // than an empty shell where the gates would be.
  if (result && !result.funnel) {
    return <LegacyResultsView result={result} onReset={onReset} />;
  }

  const funnel = result?.funnel ?? null;
  // Prefer the settled funnel; fall back to the early gates while one is in
  // flight. These never disagree — the partial carries the same computation,
  // just sooner.
  const parse = funnel?.parse ?? partial?.parse ?? null;
  const retrieve = funnel?.retrieve ?? partial?.retrieve ?? null;
  if (!parse || !retrieve) return null;

  // A run that has not settled shows no verdict word. Deriving one from two of
  // three gates would mean printing a judgement that could change seconds
  // later, which is the one thing this app does not do.
  const settled = result !== null && funnel !== null;

  const parseReasons = parse.verdict !== "clean" ? parse.reasons : [];
  const blocking = funnel
    ? funnel.knockout.checks.filter((c) => c.required && c.verdict === "fail")
    : [];
  const checkYourself = funnel
    ? funnel.knockout.checks.filter((c) => c.required && c.verdict === "unverifiable")
    : [];
  const misses = retrieve.misses;

  // A résumé that will not parse, a stated requirement it fails, and a search
  // that will not surface it all cost the user the same thing. The per-row tag
  // keeps the kinds apart.
  const stoppingCount = parseReasons.length + blocking.length + misses.length;

  const verdict = result?.summary.verdict;
  const extraction = result?.ats_extraction;
  const audit = result?.formatting_audit;

  const mustHave = result?.skills_gap?.must_have ?? [];
  const niceToHave = result?.skills_gap?.nice_to_have ?? [];
  const allSkills = [...mustHave, ...niceToHave];
  const present = allSkills.filter((s) => s.present_in_resume);
  const missing = allSkills.filter((s) => !s.present_in_resume);

  const contactFound = extraction
    ? [
        extraction.contact.email ? "email" : null,
        extraction.contact.phone ? "phone" : null,
        extraction.contact.links.length > 0 ? "links" : null,
      ].filter(Boolean)
    : [];

  const auditIssues = audit
    ? audit.whitespace_issues.length +
      audit.bullet_inconsistencies.length +
      audit.date_format_issues.length +
      audit.capitalization_issues.length +
      audit.other_inconsistencies.length
    : 0;

  const dimensions = result ? buildAtsDimensions(result) : [];

  // Tabs persist across a second analysis unless keyed off the result, so a
  // stale selection would survive a fresh run.
  const runKey = result?.metadata.analyzed_at ?? "pending";

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "questions", label: "Questions", count: result?.ambush_kit?.questions.length },
    { key: "writing", label: "Writing", count: result?.errors.length },
    { key: "sort", label: "How you sort", count: funnel?.signals.length },
    { key: "ats", label: "What the ATS sees" },
    { key: "skills", label: "Skills" },
    { key: "summary", label: "Summary" },
  ];

  return (
    <div ref={printRef} className="space-y-4">
      {/* ── Hero: the verdict, and the three gates it is derived from ───── */}
      <Reveal>
        <section className="rounded-xl border border-border bg-card px-5 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 lg:max-w-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Screening outcome
              </p>
              {settled && verdict ? (
                <>
                  <div
                    className={cn(
                      "mt-1 font-mono text-4xl font-semibold tracking-tight",
                      VERDICT_CLASS[verdict]
                    )}
                  >
                    {VERDICT_LABEL[verdict] ?? "Moderate"}
                  </div>
                  <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                    {result?.summary.headline}
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-1 font-mono text-4xl font-semibold tracking-tight text-muted-foreground">
                    Screening
                  </div>
                  <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                    Two gates are in. Still reading your writing — the last check takes the
                    longest.
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-4 lg:items-end">
              <div className="flex items-center gap-2">
                {result && <ExportButton result={result} targetRef={printRef} />}
                <Button variant="outline" size="sm" className="gap-2" onClick={onReset}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  New run
                </Button>
              </div>
              <div className="w-full">
                <GateCells
                  parse={parse}
                  knockout={funnel?.knockout ?? null}
                  retrieve={retrieve}
                />
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {result?.warnings && result.warnings.length > 0 && (
        <ul className="space-y-1">
          {result.warnings.map((w: string, i: number) => (
            <li key={i} className="flex gap-1.5 text-xs text-state-warn">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      {/* ── What a parser pulled out, as figures ────────────────────────── */}
      {settled && (
        <Reveal delay={60}>
          <section className="rounded-xl border border-border bg-card px-5 py-4">
            <h2 className="text-sm font-medium">What the ATS sees</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Every figure is a count from your document and the posting. None is a rating.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              <StatTile
                icon={LayoutList}
                label="Sections"
                value={String(extraction?.sections_detected.length ?? 0)}
                detail={extraction?.sections_detected.join(" · ") || "none detected"}
                tone={(extraction?.sections_detected.length ?? 0) > 0 ? "pass" : "warn"}
              />
              <StatTile
                icon={AtSign}
                label="Contact"
                value={`${contactFound.length}/3`}
                detail={contactFound.join(" · ") || "none found"}
                tone={
                  contactFound.length === 3 ? "pass" : contactFound.length > 0 ? "warn" : "fail"
                }
              />
              <StatTile
                icon={Type}
                label="Formatting"
                value={audit ? (auditIssues === 0 ? "Clean" : String(auditIssues)) : "—"}
                detail={
                  audit
                    ? auditIssues === 0
                      ? "no issues found"
                      : `${auditIssues === 1 ? "issue" : "issues"} found`
                    : "not reported"
                }
                tone={!audit ? "unknown" : auditIssues === 0 ? "pass" : "warn"}
              />
              <StatTile
                icon={ListChecks}
                label="Must-haves"
                value={
                  mustHave.length > 0
                    ? `${mustHave.filter((s) => s.present_in_resume).length}/${mustHave.length}`
                    : "—"
                }
                detail={mustHave.length > 0 ? "matched in your résumé" : "none stated"}
                tone={
                  mustHave.length === 0
                    ? "unknown"
                    : mustHave.every((s) => s.present_in_resume)
                      ? "pass"
                      : "warn"
                }
              />
              <StatTile
                icon={Search}
                label="Searches"
                value={retrieve.total > 0 ? `${retrieve.surfaced}/${retrieve.total}` : "—"}
                detail={retrieve.total > 0 ? "surface your résumé" : "none to run"}
                tone={
                  retrieve.total === 0
                    ? "unknown"
                    : retrieve.surfaced === retrieve.total
                      ? "pass"
                      : "warn"
                }
              />
            </div>
          </section>
        </Reveal>
      )}

      {/* ── Bottom band: what blocks you · the radar · what to fix ──────── */}
      {settled && (
        <Reveal delay={120}>
          <div className="grid items-start gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-border bg-card px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-medium">
                  {stoppingCount > 0 ? "What's stopping you" : "Nothing is stopping you"}
                </h2>
                {stoppingCount > 0 && (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {stoppingCount}
                  </span>
                )}
              </div>
              {stoppingCount === 0 ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Your résumé parses, clears every stated requirement that can be checked, and
                  surfaces for every search a recruiter would plausibly run.
                </p>
              ) : (
                <div className="mt-1">
                  {parseReasons.map((r, i) => (
                    <FindingRow
                      key={`parse-${i}`}
                      tag="PARSE"
                      tone={parse.verdict === "likely_breaks" ? "fail" : "warn"}
                    >
                      {r}
                    </FindingRow>
                  ))}
                  {blocking.map((c, i) => (
                    <FindingRow
                      key={`ko-${i}`}
                      tag="KO"
                      tone="fail"
                      meta={c.type.replace(/_/g, " ")}
                    >
                      {c.detail}
                    </FindingRow>
                  ))}
                  {misses.map((m, i) => (
                    <FindingRow key={`srch-${i}`} tag="SRCH" tone="warn">
                      No recruiter search for <span className="font-mono">{m}</span> would surface
                      you.
                    </FindingRow>
                  ))}
                </div>
              )}

              {checkYourself.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Check yourself</p>
                  {checkYourself.map((c, i) => (
                    <FindingRow key={i} tag="ASK" tone="unknown" meta={c.type.replace(/_/g, " ")}>
                      {c.detail}
                    </FindingRow>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card px-5 py-4">
              <h2 className="text-sm font-medium">ATS dimensions</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Each axis is a count, not a rating. They are never averaged.
              </p>
              <div className="mt-3">
                <AtsDimensions dimensions={dimensions} />
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card px-5 py-4">
              <h2 className="text-sm font-medium">Fix first</h2>
              {result && result.summary.top_improvements.length > 0 ? (
                <ol className="mt-2 space-y-2">
                  {result.summary.top_improvements.map((item, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                      <span className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0">{item}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Nothing was flagged as a first fix for this run.
                </p>
              )}
            </section>
          </div>
        </Reveal>
      )}

      {/* ── Skills present / missing ────────────────────────────────────── */}
      {settled && allSkills.length > 0 && (
        <Reveal delay={180}>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-medium">Skills present</h2>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {present.length}
                </span>
              </div>
              {present.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {present.map((s) => (
                    <SkillBadge key={s.name} skill={s} />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  None of the posting&apos;s skills appear in your résumé.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-medium">Skills missing</h2>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {missing.length}
                </span>
              </div>
              {missing.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {missing.map((s) => (
                    <SkillBadge key={s.name} skill={s} />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Every skill the posting names appears in your résumé.
                </p>
              )}
            </section>
          </div>
        </Reveal>
      )}

      {!settled && (
        <Reveal delay={120}>
          <PendingPanel title="Writing" lines={3} />
        </Reveal>
      )}

      {/* ── Detail, grouped behind tabs rather than six equal accordions ── */}
      {settled && result && (
        <Reveal delay={240}>
          <section className="rounded-xl border border-border bg-card">
            <div
              className="flex gap-1 overflow-x-auto border-b border-border px-2 pt-2"
              role="tablist"
              aria-label="Result detail"
            >
              {tabs.map((t) => (
                <button
                  key={`${runKey}-${t.key}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "shrink-0 rounded-t-md px-3 py-2 text-sm transition-colors",
                    tab === t.key
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                  {typeof t.count === "number" && t.count > 0 && (
                    <span className="ml-1.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="px-5 py-4">
              {tab === "questions" && <AmbushKitPanel kit={result.ambush_kit} />}

              {tab === "writing" &&
                (result.errors.length > 0 ? (
                  <ErrorReportPanel errors={result.errors} />
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    No writing findings for this run.
                  </p>
                ))}

              {tab === "sort" && (
                <>
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                    Nothing here is a rejection, and these are deliberately not combined into a
                    score — ResCheck has no other applicants to rank you against.
                  </p>
                  {funnel && funnel.signals.length > 0 ? (
                    funnel.signals.map((s) => (
                      <div
                        key={s.key}
                        className="border-b border-border/60 py-2.5 last:border-b-0"
                      >
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="text-sm">{s.label}</span>
                          <span className="shrink-0 font-mono text-sm tabular-nums">{s.value}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No sorting signals could be measured for this run.
                    </p>
                  )}
                </>
              )}

              {tab === "ats" &&
                (result.formatting_audit ? (
                  <FormattingAuditPanel
                    audit={result.formatting_audit}
                    atsExtraction={result.ats_extraction}
                  />
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    This run has no formatting audit — it was saved before the audit existed.
                  </p>
                ))}

              {tab === "skills" && <SkillsGapPanel skillsGap={result.skills_gap} />}

              {tab === "summary" && (
                <SummaryPanel summary={result.summary} metadata={result.metadata} />
              )}
            </div>
          </section>
        </Reveal>
      )}
    </div>
  );
}
