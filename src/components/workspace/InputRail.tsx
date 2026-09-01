"use client";

import { AlertCircle, ArrowRight, Sparkles, Lock, Sigma, MonitorSmartphone } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResumeUploader } from "@/components/analyze/ResumeUploader";
import { JobDescriptionInput } from "@/components/analyze/JobDescriptionInput";
import { ProgressStream } from "@/components/analyze/ProgressStream";
import type { AnalysisStage } from "@/hooks/useAnalysis";

interface InputRailProps {
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  file: File | null;
  onFileAccepted: (file: File) => void;
  onFileRejected: (reason: string) => void;
  onClear: () => void;
  fileError: string | null;
  canSubmit: boolean;
  isRunning: boolean;
  hydrated: boolean;
  hasKey: boolean;
  freeRunsRemaining: number | null;
  freeRunLimit: number;
  outOfFreeRuns: boolean;
  hostedUnavailable: boolean;
  needsOwnKey: boolean;
  stage: AnalysisStage;
  progress: number;
  warnings: string[];
  error: string | null;
  onSubmit: () => void;
  onOpenSettings: () => void;
}

// Each of these is a property of how the app is built, not a promise about how
// it will feel. "Results in seconds" is the obvious thing to write in this row
// and it would be false: the median run is ~25s and the tail reaches 83s.
const ASSURANCES = [
  {
    icon: Lock,
    name: "No copy kept",
    body: "Your résumé is read once to build the report, then dropped.",
  },
  {
    icon: Sigma,
    name: "Derived, never invented",
    body: "Every figure is counted from your documents, not rated by a model.",
  },
  {
    icon: MonitorSmartphone,
    name: "No account",
    body: "Your history stays in this browser. There is nothing to log into.",
  },
];

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs text-accent-foreground">
      {n}
    </span>
  );
}

export function InputRail({
  jobDescription, onJobDescriptionChange, file, onFileAccepted, onFileRejected,
  onClear, fileError, canSubmit, isRunning, hydrated, hasKey,
  freeRunsRemaining, freeRunLimit, outOfFreeRuns, hostedUnavailable, needsOwnKey,
  stage, progress, warnings, error, onSubmit, onOpenSettings,
}: InputRailProps) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="mx-auto w-full max-w-5xl border-b border-border px-6 py-12"
    >
      <Reveal>
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent px-3 py-1 text-xs text-accent-foreground">
            <Sparkles className="h-3 w-3" aria-hidden />
            AI reads the documents. Code decides.
          </span>
        </div>
      </Reveal>

      <Reveal delay={40}>
        {/* The emphasis is carried by ink weight, not a new hue: --primary is
            espresso in light and warm off-white in dark, so a coloured second
            line would vanish into the first in one theme or the other. Status
            colours are reserved for gate state and cannot be borrowed here. */}
        <h1 className="mt-5 text-center text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl">
          <span className="text-muted-foreground">See what screening</span>
          <br />
          does to your résumé.
        </h1>
      </Reveal>

      <Reveal delay={80}>
        <p className="mx-auto mt-4 max-w-xl text-center text-[length:var(--step--1)] leading-relaxed text-muted-foreground">
          Add your résumé and the posting you are applying to. ResCheck reports whether the
          document parses, whether you meet the requirements it states, and whether a
          recruiter&apos;s search would surface you.
        </p>
      </Reveal>

      {hydrated && !hasKey && !needsOwnKey && freeRunsRemaining !== null && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">{freeRunsRemaining}</span>{" "}
          {freeRunsRemaining === 1 ? "free analysis" : "free analyses"} left on us — no key needed.{" "}
          <button
            type="button"
            onClick={onOpenSettings}
            className="font-medium text-primary underline underline-offset-2"
          >
            Add your own key
          </button>{" "}
          for unlimited runs.
        </p>
      )}

      {hydrated && (outOfFreeRuns || hostedUnavailable) && (
        <div className="mx-auto mt-6 max-w-3xl space-y-4">
          {outOfFreeRuns && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You&apos;ve used your {freeRunLimit} free{" "}
                {freeRunLimit === 1 ? "analysis" : "analyses"}.{" "}
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  Add your own API key
                </button>{" "}
                for unlimited runs — it is stored in your browser and never kept on our server.
              </AlertDescription>
            </Alert>
          )}

          {hostedUnavailable && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Free analyses aren&apos;t available on this deployment.{" "}
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  Add your own API key
                </button>{" "}
                to run one — it is stored in your browser and never kept on our server.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Reveal delay={120} className="h-full">
          <section className="flex h-full flex-col rounded-xl border border-border bg-card px-5 py-5">
            <div className="flex items-center gap-2.5">
              <StepBadge n={1} />
              <h2 className="text-sm font-medium">Your résumé</h2>
            </div>
            {/* Centred rather than top-aligned: once a file is chosen the
                uploader collapses to a small chip, and left at the top of a
                card sized to its taller neighbour it strands a block of empty
                space underneath. */}
            <div className="mt-4 flex flex-1 flex-col justify-center">
              <ResumeUploader
                file={file}
                onFileAccepted={onFileAccepted}
                onFileRejected={onFileRejected}
                onClear={onClear}
              />
            </div>
            {fileError && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-state-fail">
                <AlertCircle className="h-3.5 w-3.5" />
                {fileError}
              </p>
            )}
          </section>
        </Reveal>

        <Reveal delay={160} className="h-full">
          <section className="flex h-full flex-col rounded-xl border border-border bg-card px-5 py-5">
            <div className="flex items-center gap-2.5">
              <StepBadge n={2} />
              <h2 className="text-sm font-medium">Job description</h2>
            </div>
            <div className="mt-4 flex-1">
              <JobDescriptionInput value={jobDescription} onChange={onJobDescriptionChange} />
            </div>
          </section>
        </Reveal>
      </div>

      {(isRunning || (stage === "error" && error)) && (
        <div className="mx-auto mt-6 max-w-3xl space-y-4">
          {isRunning && <ProgressStream stage={stage} progress={progress} />}

          {isRunning && warnings.length > 0 && (
            <ul className="space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-state-warn">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          )}

          {stage === "error" && error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <Reveal delay={200}>
        <div className="mt-8 space-y-2">
          <Button
            type="submit"
            disabled={!canSubmit}
            // The arrow and the shadow are the whole hover event. No lift here:
            // the primitive already owns an active-press transform, and two
            // competing translates read as a wobble rather than a press.
            className="group mx-auto flex h-12 w-full max-w-md rounded-xl text-base font-medium shadow-sm transition-[background-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-settle)] hover:shadow-md disabled:shadow-none"
          >
            {isRunning ? (
              "Analysing…"
            ) : (
              <>
                <Sparkles className="mr-1.5 size-4" aria-hidden />
                Analyse résumé
                <ArrowRight className="ml-1.5 size-4 transition-transform duration-[var(--dur-fast)] ease-[var(--ease-settle)] group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
          {/* Reserved height so the hint appearing never nudges the button. */}
          <p className="flex h-4 items-center justify-center gap-1.5 text-xs text-muted-foreground">
            {!canSubmit && !isRunning && hydrated ? (
              needsOwnKey ? (
                "Add an API key in settings first"
              ) : !file ? (
                "Add your résumé to continue"
              ) : (
                "Paste a job description to continue"
              )
            ) : (
              <>
                <Lock className="h-3 w-3" aria-hidden />
                No copy of your résumé is kept
              </>
            )}
          </p>
        </div>
      </Reveal>

      <Reveal delay={240}>
        <ul className="mt-10 grid gap-5 sm:grid-cols-3">
          {ASSURANCES.map(({ icon: Icon, name, body }) => (
            <li key={name} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
                <Icon className="h-4 w-4 text-accent-foreground" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Reveal>
    </form>
  );
}
