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

// A condition the application form asks and a resume never states. Matching
// must be phrase-level: a bare stem match turned "Bachelor's degree in Remote
// Sensing" into a location condition and skipped the degree check entirely —
// every alternative below is anchored to a phrase that makes it an actual
// hiring condition, not just a word that also shows up in unrelated text.
const ELIGIBILITY_OR_LOCATION_PATTERN =
  /\b(work(ing)?\s+(authoriz|authoris|eligib|permit)|authoriz\w*\s+to\s+work|legally\s+authoriz|right\s+to\s+work|work\s+visa|visa\s+(status|sponsorship|required)|sponsorship|require\w*\s+sponsorship|citizenship|u\.?s\.?\s+citizen|security\s+clearance|willing(ness)?\s+to\s+relocate|able\s+to\s+relocate|relocation\s+required|must\s+(be\s+)?(located|based|reside)|on-?site\s+\d|days?\s+(a|per)\s+week\s+in|hybrid\s+(role|schedule|work|position|—|-)|fully\s+remote|remote\s+(role|position|work\s+arrangement))\b/i;
// The location-flavored subset of the pattern above — used only to pick which
// detail string to show once the guard has already fired, not to decide
// whether it fires (that's the combined pattern).
const LOCATION_ONLY_PATTERN =
  /\b(willing(ness)?\s+to\s+relocate|able\s+to\s+relocate|relocation\s+required|must\s+(be\s+)?(located|based|reside)|on-?site\s+\d|days?\s+(a|per)\s+week\s+in|hybrid\s+(role|schedule|work|position|—|-)|fully\s+remote|remote\s+(role|position|work\s+arrangement))\b/i;

const WORK_AUTH_DETAIL =
  "A resume doesn't state work authorization, and ResCheck never sees the application form — the form will ask this, so check it yourself.";
const LOCATION_DETAIL =
  "A resume doesn't state location or willingness to relocate — the application form will ask, so check it yourself.";

// Returns which never-verifiable copy applies, or null when the requirement
// is neither. The value-text guard runs ONLY for "certification": degree and
// years_experience have their own evidence-based branches below and must
// never be pre-empted by a value-text match (a shortfall or a match there is
// real evidence; a value-text guess is not). work_authorization and location
// are already handled by the r.type check above, so the guard is moot for
// them. certification is where the model actually misfiles these —
// normalizeRequirementType maps "license" -> certification — so that's the
// one type this guard needs to protect.
function neverVerifiableType(r: JdRequirement): "work_authorization" | "location" | null {
  if (NEVER_VERIFIABLE.includes(r.type)) return r.type as "work_authorization" | "location";
  if (r.type !== "certification") return null;
  if (!ELIGIBILITY_OR_LOCATION_PATTERN.test(r.value)) return null;
  return LOCATION_ONLY_PATTERN.test(r.value) ? "location" : "work_authorization";
}

// Resume dates land on month boundaries the candidate rounded themselves, so
// someone within a quarter of the requirement is not "clearly below" it.
const YEARS_GRACE_MONTHS = 3;

export interface KnockoutContext {
  structured: StructuredResume;
  resumeText: string;
  totalExperienceMonths: number;
  hasDatedRoles: boolean;
  // False when some role the model reported has no parsed date range, so
  // totalExperienceMonths is built from a subset of the roles rather than
  // all of them — a shortfall computed on that subset is not proof of one.
  datedRolesComplete: boolean;
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

// Every degree level a text names, split by how strongly it's named: as a
// credential form ("M.S.", "Master's degree") or only a bare, ambiguous
// mention ("Master's Program"). One scan feeds both degreeLevelsIn (resume
// side, wants the highest held) and minDegreeLevelIn (requirement side, wants
// the lowest named — see that function for why).
function matchedDegreeLevels(text: string): { credential: number[]; any: number[] } {
  const norm = normalizeSkill(text);
  const credential: number[] = [];
  const any: number[] = [];
  for (const group of DEGREE_GROUPS) {
    const credentialForms = group.aliases.filter((a) => !group.ambiguous.includes(a));
    if (credentialForms.some((a) => containsLiteral(norm, a))) {
      credential.push(group.level);
      any.push(group.level);
    } else if (group.ambiguous.some((a) => skillAppearsIn(norm, a))) {
      any.push(group.level);
    }
  }
  return { credential, any };
}

// The highest degree level claimed as a credential ("M.S.", "Master's degree")
// and the highest named at all, including bare mentions ("Master's"), which
// someone can write without holding one. Gate 2 needs both: a bare mention is
// not proof of the degree, and not proof of its absence either. Used on the
// RESUME side, where the candidate's highest credential should count.
function degreeLevelsIn(text: string): { credential: number; any: number } {
  const { credential, any } = matchedDegreeLevels(text);
  return {
    credential: credential.length > 0 ? Math.max(...credential) : 0,
    any: any.length > 0 ? Math.max(...any) : 0,
  };
}

// The LOWEST degree level a requirement names is the one that satisfies it:
// "Bachelor's or Master's degree", "BS/MS in Computer Science" and
// "Bachelor's required, Master's preferred" are ordinary either/or phrasings
// that a Bachelor's holder clears, not a Master's requirement. Math.max is
// only correct on the resume side (degreeLevelsIn); the requirement side
// takes the minimum of whatever levels the text names.
function minDegreeLevelIn(text: string): number {
  const { any } = matchedDegreeLevels(text);
  return any.length > 0 ? Math.min(...any) : 0;
}

function requiredYears(value: string): number | null {
  const n = Number(value.match(/\d+/)?.[0] ?? NaN);
  return Number.isFinite(n) ? n : null;
}

function checkRequirement(r: JdRequirement, ctx: KnockoutContext): KnockoutCheck {
  const base = { type: r.type, value: r.value, required: r.required };

  const forcedType = neverVerifiableType(r);
  if (forcedType) {
    return {
      ...base,
      verdict: "unverifiable",
      detail: forcedType === "work_authorization" ? WORK_AUTH_DETAIL : LOCATION_DETAIL,
    };
  }

  if (r.type === "degree") {
    const education = ctx.structured.sections.filter((s) => s.name === "education");
    if (education.length === 0) {
      return { ...base, verdict: "unverifiable", detail: "No education section could be parsed, so this couldn't be checked." };
    }
    const needed = minDegreeLevelIn(r.value);
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
    if (ctx.totalExperienceMonths + YEARS_GRACE_MONTHS >= years * 12) {
      return { ...base, verdict: "pass", detail };
    }
    // A shortfall computed from an incomplete date set isn't proof of one —
    // an unread role's dates could close the gap. More evidence only ever
    // raises the total, so a PASS above stands on incomplete data; a FAIL
    // does not.
    if (!ctx.datedRolesComplete) {
      return {
        ...base,
        verdict: "unverifiable",
        detail: `${detail} Some of your roles' dates couldn't be read, so this total may be incomplete — check it yourself.`,
      };
    }
    return { ...base, verdict: "fail", detail };
  }

  // certification — a credential name needs a literal, contiguous match
  // (containsLiteral), the same rule degree credential forms use: scattered
  // words ("AWS" ... "solutions" ... "Architect" as a job title) are not the
  // same claim as holding "AWS Solutions Architect". A fuzzy-only hit reports
  // unverifiable, never a pass — this is the only true auto-rejection gate,
  // so a false pass here is the costliest mistake this file can make.
  const resumeNorm = normalizeSkill(ctx.resumeText);
  const certNorm = normalizeSkill(r.value);
  if (containsLiteral(resumeNorm, certNorm)) {
    return { ...base, verdict: "pass", detail: `"${r.value}" appears in your resume.` };
  }
  if (skillAppearsIn(resumeNorm, certNorm)) {
    return {
      ...base,
      verdict: "unverifiable",
      detail: `The exact credential "${r.value}" wasn't found, but related words appear elsewhere in your resume — check this one yourself.`,
    };
  }
  return { ...base, verdict: "fail", detail: `"${r.value}" doesn't appear anywhere in your resume.` };
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

// Prefers a required years item — that's the one that can actually knock
// someone out, so it's the one the "how you sort" signal should be measured
// against. Only falls back to a preferred item when the posting states no
// required one, rather than letting requirements-array order decide.
export function firstRequiredYears(requirements: JdRequirement[]): number | null {
  let fallback: number | null = null;
  for (const r of requirements) {
    if (r.type !== "years_experience") continue;
    const years = requiredYears(r.value);
    if (years === null) continue;
    if (r.required) return years;
    if (fallback === null) fallback = years;
  }
  return fallback;
}

// Replaces the verdict that used to be derived from overall_ats_score. It is
// derived from the gates instead, so it cannot outlive the deleted score.
export function deriveFunnelVerdict(funnel: FunnelResult): ExecutiveSummary["verdict"] {
  const { parse, knockout, retrieve } = funnel;
  if (knockout.verdict === "fail") return "critical";
  const majorityMissed = retrieve.total > 0 && retrieve.surfaced * 2 < retrieve.total;
  if (parse.verdict === "likely_breaks" || majorityMissed) return "needs_work";
  // "strong" claims all three gates were checked AND cleared — a gate that
  // was never actually run (no stated knockout condition, or no retrievable
  // must-have skills) cannot count as cleared, or the headline built on this
  // verdict (VERDICT_HEADLINE.strong) would claim a clearance nothing granted.
  const allGatesChecked = knockout.stated && retrieve.total > 0;
  if (
    !allGatesChecked ||
    parse.verdict === "risky" ||
    knockout.verdict === "unverifiable" ||
    retrieve.misses.length > 0
  ) {
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
  // False when the model reported a role whose dates didn't parse — see
  // KnockoutContext.datedRolesComplete.
  datedRolesComplete: boolean;
}

export function buildFunnel(input: FunnelInput): FunnelResult {
  return {
    parse: evaluateParseGate(input.structured, input.audit),
    knockout: evaluateKnockoutGate(input.requirements, {
      structured: input.structured,
      resumeText: input.resumeText,
      totalExperienceMonths: input.metrics.total_experience_months,
      hasDatedRoles: input.hasDatedRoles,
      datedRolesComplete: input.datedRolesComplete,
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
