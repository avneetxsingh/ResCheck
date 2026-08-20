// The screening funnel: three gates over data the pipeline already computed.
// Every verdict here is produced by code, so two runs of the same resume
// against the same posting always agree — no model judgment is involved.
import type {
  FormattingAudit, ParseGate,
} from "@/types/analysis";
import type { StructuredResume } from "./ats-extract";
import { AUDIT_KEYS } from "./scoring";

const RISKY_AUDIT_ISSUES = 4;

// Gate 1 — does the document survive extraction? Nothing new is computed here:
// this is a verdict over the parse warnings and the formatting audit.
export function evaluateParseGate(structured: StructuredResume, audit: FormattingAudit): ParseGate {
  const reasons = [...structured.warnings];
  const auditCount = AUDIT_KEYS.reduce((n, k) => n + audit[k].length, 0);
  if (auditCount >= RISKY_AUDIT_ISSUES) {
    reasons.push(`${auditCount} formatting inconsistencies — the Formatting tab quotes each one.`);
  }

  const noHeadings = structured.sections.every((s) => s.heading === "");
  // Either contact route surviving is enough for a recruiter to reach the
  // candidate, so only losing both is a break.
  const noContact = structured.contact.email === null && structured.contact.phone === null;
  if (noHeadings || noContact) return { verdict: "likely_breaks", reasons };
  if (structured.warnings.length > 0 || auditCount >= RISKY_AUDIT_ISSUES) {
    return { verdict: "risky", reasons };
  }
  return { verdict: "clean", reasons };
}
