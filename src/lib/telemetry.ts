import { track } from "@vercel/analytics";

/**
 * The funnel, and the one place that decides what may leave the browser.
 *
 * NOTHING DERIVED FROM A USER'S DOCUMENTS GOES THROUGH HERE. Not the résumé,
 * not the posting, not the verdict, not a skill name, not a word count — those
 * describe a person's job search, and this app's whole promise is that it keeps
 * no such record. Every property below describes the *app*: which mode served
 * the run, how long it took, and why it failed. That is enough to know whether
 * the thing works and where people fall out, and no more.
 *
 * Named telemetry rather than metrics because `metrics` already means something
 * here — WorkHistoryMetrics in funnel.ts computes tenure and gaps.
 *
 * Analytics must never be able to break an analysis, so every call is wrapped:
 * a blocked script, an ad blocker or a network failure is silently fine.
 */
export type TelemetryEvent =
  /** Opened the full sample report on the landing page — interest without an upload. */
  | "sample_opened"
  /** A PDF was accepted by the uploader — intent. */
  | "resume_added"
  /** Pressed Analyse and the request went out. */
  | "analysis_started"
  /** A report was rendered. This is the number that means the product worked. */
  | "analysis_completed"
  /** The run failed. `reason` says whether that was capacity, auth, or us. */
  | "analysis_failed";

interface TelemetryProps {
  /** Whose key paid for it — ours or the visitor's. Says nothing about them. */
  mode?: "hosted" | "byok";
  /** A coarse failure category. Never a raw error message. */
  reason?: string;
  /** Wall-clock seconds, rounded. Tells us whether the tail is as slow as we think. */
  seconds?: number;
}

export function trackEvent(event: TelemetryEvent, props?: TelemetryProps): void {
  try {
    track(event, props ? { ...props } : undefined);
  } catch {
    // Measurement is never worth a broken run.
  }
}
