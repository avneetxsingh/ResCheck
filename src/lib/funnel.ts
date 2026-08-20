// The screening funnel: three gates over data the pipeline already computed.
// Every verdict here is produced by code, so two runs of the same resume
// against the same posting always agree — no model judgment is involved.
import type {
  CompetitivenessSignal, ExecutiveSummary, FormattingAudit, FunnelResult, GateVerdict,
  JdRequirement, KnockoutCheck, KnockoutGate, ParseGate, RequirementType, RetrievalQuery,
  RetrieveGate, Skill,
} from "@/types/analysis";
import type { StructuredResume } from "./ats-extract";
import { DEGREE_GROUPS, normalizeSkill, skillAppearsIn } from "./keyword-match";
import { AUDIT_KEYS } from "./scoring";
import type { WorkHistoryMetrics } from "./work-history";

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

const REQUIREMENT_TYPES: RequirementType[] = [
  "degree", "years_experience", "certification", "work_authorization", "location",
];

// The model does not reliably emit the canonical token, so normalization
// happens here rather than in a zod enum: an unrecognized type returns null
// and the caller drops the record instead of inventing a check for it.
export function normalizeRequirementType(raw: string): RequirementType | null {
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((REQUIREMENT_TYPES as string[]).includes(t)) return t as RequirementType;
  if (/^(education|degree_level|academic)$/.test(t)) return "degree";
  if (/^(years|experience|years_of_experience|experience_years|min_experience|minimum_experience)$/.test(t)) {
    return "years_experience";
  }
  if (/^(cert|certs|certifications|license|licenses|licence|licences)$/.test(t)) return "certification";
  if (/^(work_auth|authorization|authorisation|visa|citizenship|work_eligibility|sponsorship)$/.test(t)) {
    return "work_authorization";
  }
  if (/^(locations|onsite|on_site|remote|hybrid|work_location|relocation)$/.test(t)) return "location";
  return null;
}

// A resume states neither of these, and ResCheck never sees the application
// form that asks them. Returning pass or fail here would be exactly the false
// precision the funnel exists to remove, so the answer is always the same one.
const NEVER_VERIFIABLE: RequirementType[] = ["work_authorization", "location"];

// Resume dates land on month boundaries the candidate rounded themselves, so
// someone within a quarter of the requirement is not "clearly below" it.
const YEARS_GRACE_MONTHS = 3;

export interface KnockoutContext {
  structured: StructuredResume;
  resumeText: string;
  totalExperienceMonths: number;
  hasDatedRoles: boolean;
}

export function monthsLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} month${rest === 1 ? "" : "s"}`;
  if (rest === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years}y ${rest}m`;
}

// A literal, word-bounded check with no alias fan-out — deliberately not
// skillAppearsIn. skillAppearsIn's aliasesFor step treats every alias in a
// DEGREE_GROUPS entry as interchangeable with its siblings (that's what makes
// "k8s" find "Kubernetes"), so calling it on a credential form like "m.s."
// would also match on the bare "master s" text alone, via that form's own
// ambiguous sibling in the same group — reopening the exact hole this
// function exists to close. Credential detection needs the literal string.
function containsLiteral(haystackNorm: string, term: string): boolean {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(haystackNorm);
}

// The highest degree level claimed as a credential ("M.S.", "Master's degree")
// and the highest named at all, including bare mentions ("Master's"), which
// someone can write without holding one. Gate 2 needs both: a bare mention is
// not proof of the degree, and not proof of its absence either.
function degreeLevelsIn(text: string): { credential: number; any: number } {
  const norm = normalizeSkill(text);
  let credential = 0;
  let any = 0;
  for (const group of DEGREE_GROUPS) {
    const credentialForms = group.aliases.filter((a) => !group.ambiguous.includes(a));
    if (credentialForms.some((a) => containsLiteral(norm, a))) {
      credential = Math.max(credential, group.level);
      any = Math.max(any, group.level);
    } else if (group.ambiguous.some((a) => skillAppearsIn(norm, a))) {
      any = Math.max(any, group.level);
    }
  }
  return { credential, any };
}

function requiredYears(value: string): number | null {
  const n = Number(value.match(/\d+/)?.[0] ?? NaN);
  return Number.isFinite(n) ? n : null;
}

function checkRequirement(r: JdRequirement, ctx: KnockoutContext): KnockoutCheck {
  const base = { type: r.type, value: r.value, required: r.required };

  if (NEVER_VERIFIABLE.includes(r.type)) {
    return {
      ...base,
      verdict: "unverifiable",
      detail:
        r.type === "work_authorization"
          ? "A resume doesn't state work authorization, and ResCheck never sees the application form — the form will ask this, so check it yourself."
          : "A resume doesn't state location or willingness to relocate — the application form will ask, so check it yourself.",
    };
  }

  if (r.type === "degree") {
    const education = ctx.structured.sections.filter((s) => s.name === "education");
    if (education.length === 0) {
      return { ...base, verdict: "unverifiable", detail: "No education section could be parsed, so this couldn't be checked." };
    }
    const needed = degreeLevelsIn(r.value).any;
    if (needed === 0) {
      return {
        ...base,
        verdict: "unverifiable",
        detail: `"${r.value}" doesn't name a degree level, so check it against your education section yourself.`,
      };
    }
    const held = degreeLevelsIn(education.flatMap((s) => s.lines).join("\n"));
    if (held.credential >= needed) {
      return { ...base, verdict: "pass", detail: "Your education section shows an equal or higher degree." };
    }
    if (held.any >= needed) {
      return {
        ...base,
        verdict: "unverifiable",
        detail: `Your education section mentions ${r.value} but not as a credential you hold — check this one yourself.`,
      };
    }
    return { ...base, verdict: "fail", detail: `The posting asks for ${r.value}; your education section doesn't show one.` };
  }

  if (r.type === "years_experience") {
    const years = requiredYears(r.value);
    if (years === null) {
      return { ...base, verdict: "unverifiable", detail: `"${r.value}" states no number of years, so it couldn't be checked.` };
    }
    if (!ctx.hasDatedRoles) {
      return { ...base, verdict: "unverifiable", detail: "No dated roles could be located in the resume, so total experience is unknown." };
    }
    const detail = `${monthsLabel(ctx.totalExperienceMonths)} of dated experience against ${years} year${years === 1 ? "" : "s"} required.`;
    return ctx.totalExperienceMonths + YEARS_GRACE_MONTHS >= years * 12
      ? { ...base, verdict: "pass", detail }
      : { ...base, verdict: "fail", detail };
  }

  // certification — the resume text already contains the certifications
  // section, so one haystack covers both places the spec asks us to look.
  const found = skillAppearsIn(normalizeSkill(ctx.resumeText), normalizeSkill(r.value));
  return found
    ? { ...base, verdict: "pass", detail: `"${r.value}" appears in your resume.` }
    : { ...base, verdict: "fail", detail: `"${r.value}" doesn't appear anywhere in your resume.` };
}

// Gate 2 — a requirement the posting marks preferred is checked identically but
// never fails the gate: a missing nice-to-have does not stop an application.
export function evaluateKnockoutGate(
  requirements: JdRequirement[],
  ctx: KnockoutContext
): KnockoutGate {
  const checks = requirements.map((r) => checkRequirement(r, ctx));
  const required = checks.filter((c) => c.required);
  const verdict: GateVerdict = required.some((c) => c.verdict === "fail")
    ? "fail"
    : required.some((c) => c.verdict === "unverifiable")
      ? "unverifiable"
      : "pass";
  return { verdict, stated: required.length > 0, checks };
}

// AND pairs come from the top three must-haves only. That bounds the query set
// by construction — 15 skills yield 15 singles plus 3 pairs, not 105 pairs.
const AND_PAIR_SOURCE = 3;

export function buildRetrievalQueries(mustHaveNames: string[]): string[][] {
  const names = mustHaveNames.map((n) => n.trim()).filter((n) => n.length > 0);
  const queries: string[][] = names.map((n) => [n]);
  const top = names.slice(0, AND_PAIR_SOURCE);
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) queries.push([top[i], top[j]]);
  }
  return queries;
}

// Gate 3 — a skill whose only evidence is weak tier still counts as
// retrievable: a boolean search matches text, not credibility. Credibility is
// reported as a competitiveness signal instead.
export function evaluateRetrieveGate(mustHaveNames: string[], resumeText: string): RetrieveGate {
  const haystack = normalizeSkill(resumeText);
  const queries: RetrievalQuery[] = buildRetrievalQueries(mustHaveNames).map((terms) => ({
    label: terms.join(" AND "),
    terms,
    surfaces: terms.every((t) => skillAppearsIn(haystack, normalizeSkill(t))),
  }));
  return {
    queries,
    surfaced: queries.filter((q) => q.surfaces).length,
    total: queries.length,
    misses: queries.filter((q) => !q.surfaces).map((q) => q.label),
  };
}

// A skill last used more than two years ago sorts below the same skill used
// recently. Matches the RECENT_MONTHS threshold evidence scoring already uses.
const STALE_MONTHS = 24;

export interface SignalsInput {
  mustHave: Skill[];
  metrics: WorkHistoryMetrics;
  requiredYears: number | null;
}

// Named factors, never summed. Each is omitted entirely when its underlying
// value does not exist, so an absent signal means "not measurable", not "zero".
export function buildSignals(input: SignalsInput): CompetitivenessSignal[] {
  const { mustHave, metrics, requiredYears } = input;
  const signals: CompetitivenessSignal[] = [];

  if (metrics.total_experience_months > 0) {
    signals.push({
      key: "total_experience",
      label: "Total dated experience",
      value: monthsLabel(metrics.total_experience_months),
      detail:
        requiredYears !== null
          ? `The posting asks for ${requiredYears} year${requiredYears === 1 ? "" : "s"}. Length of experience is the most common thing a recruiter sorts on.`
          : "The posting states no year requirement, but length of experience is still the most common thing a recruiter sorts on.",
    });
  }

  const stale = mustHave.filter(
    (s) => typeof s.last_used_months_ago === "number" && s.last_used_months_ago > STALE_MONTHS
  );
  if (stale.length > 0) {
    signals.push({
      key: "skill_recency",
      label: "Required skills last used over 2 years ago",
      value: String(stale.length),
      detail: `${stale.slice(0, 3).map((s) => s.name).join(", ")} — a stale skill sorts below the same skill used recently.`,
    });
  }

  if (metrics.avg_tenure_months !== null) {
    signals.push({
      key: "avg_tenure",
      label: "Average time per role",
      value: monthsLabel(metrics.avg_tenure_months),
      detail: "Short average tenure is a common stability screen.",
    });
  }

  if (metrics.gap_months.length > 0) {
    signals.push({
      key: "employment_gaps",
      label: "Employment gaps over 6 months",
      value: String(metrics.gap_months.length),
      detail: `The longest is ${monthsLabel(Math.max(...metrics.gap_months))}. Gaps get flagged often; one line explaining it usually settles the question.`,
    });
  }

  const unevidenced = mustHave.filter((s) => s.strength === "weak");
  if (unevidenced.length > 0) {
    const named = unevidenced.slice(0, 3).map((s) => s.name);
    signals.push({
      key: "unevidenced_skills",
      label: "Required skills listed but not evidenced",
      value: String(unevidenced.length),
      detail: `${named.join(", ")} ${named.length === 1 ? "appears" : "appear"} in a list with no dated role behind ${named.length === 1 ? "it" : "them"} — that reads as keyword stuffing.`,
    });
  }

  return signals;
}

export function firstRequiredYears(requirements: JdRequirement[]): number | null {
  for (const r of requirements) {
    if (r.type !== "years_experience") continue;
    const years = requiredYears(r.value);
    if (years !== null) return years;
  }
  return null;
}

// Replaces the verdict that used to be derived from overall_ats_score. It is
// derived from the gates instead, so it cannot outlive the deleted score.
export function deriveFunnelVerdict(funnel: FunnelResult): ExecutiveSummary["verdict"] {
  const { parse, knockout, retrieve } = funnel;
  if (knockout.verdict === "fail") return "critical";
  const majorityMissed = retrieve.total > 0 && retrieve.surfaced * 2 < retrieve.total;
  if (parse.verdict === "likely_breaks" || majorityMissed) return "needs_work";
  if (parse.verdict === "risky" || knockout.verdict === "unverifiable" || retrieve.misses.length > 0) {
    return "moderate";
  }
  return "strong";
}

export interface FunnelInput {
  structured: StructuredResume;
  audit: FormattingAudit;
  resumeText: string;
  requirements: JdRequirement[];
  mustHave: Skill[];
  metrics: WorkHistoryMetrics;
  hasDatedRoles: boolean;
}

export function buildFunnel(input: FunnelInput): FunnelResult {
  return {
    parse: evaluateParseGate(input.structured, input.audit),
    knockout: evaluateKnockoutGate(input.requirements, {
      structured: input.structured,
      resumeText: input.resumeText,
      totalExperienceMonths: input.metrics.total_experience_months,
      hasDatedRoles: input.hasDatedRoles,
    }),
    retrieve: evaluateRetrieveGate(
      input.mustHave.map((s) => s.name),
      input.resumeText
    ),
    signals: buildSignals({
      mustHave: input.mustHave,
      metrics: input.metrics,
      requiredYears: firstRequiredYears(input.requirements),
    }),
  };
}
